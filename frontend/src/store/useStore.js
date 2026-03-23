import { create } from 'zustand';
import { projectsApi, floorsApi, apsApi, wallsApi, shelvingZonesApi } from '../lib/api';

const useStore = create((set, get) => ({
  // ── Project / floor state ──────────────────────────────────────────────────
  projects: [],
  currentProject: null,
  floors: [],
  currentFloor: null,
  walls: [],
  accessPoints: [],
  shelvingZones: [],
  loading: false,
  error: null,

  // ── Tool state ─────────────────────────────────────────────────────────────
  activeTool: 'select', // 'select' | 'scale' | 'drawWall' | 'placeAP'
  selectedMaterial: 'concrete', // wall material id
  selectedFrequency: '2.4', // '2.4' or '5'
  showHeatmap: false,
  heatmapMode: 'coverage', // 'coverage' or 'overlap'
  selectedZoneType: 'shelf_full', // shelving zone type

  // ── Scale calibration ──────────────────────────────────────────────────────
  scalePoint1: null, // {x, y} first click
  scalePoint2: null, // {x, y} second click
  pixelsPerMeter: 0,

  // ── Wall drawing ───────────────────────────────────────────────────────────
  drawingWallStart: null, // {x, y} start point of wall being drawn
  currentGroupId: null,   // UUID shared by all walls in the current chain

  // ── Project actions ────────────────────────────────────────────────────────
  fetchProjects: async () => {
    set({ loading: true });
    try {
      const res = await projectsApi.list();
      set({ projects: res.data, loading: false });
    } catch (e) { set({ error: e.message, loading: false }); }
  },

  createProject: async (name, description) => {
    const res = await projectsApi.create({ name, description });
    set(s => ({ projects: [...s.projects, res.data] }));
    return res.data;
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id);
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }));
  },

  setCurrentProject: async (project) => {
    set({ currentProject: project, floors: [], currentFloor: null, walls: [], accessPoints: [] });
    if (project) {
      const res = await floorsApi.list(project.id);
      set({ floors: res.data });
    }
  },

  // ── Floor actions ──────────────────────────────────────────────────────────
  uploadFloor: async (file, name) => {
    const { currentProject } = get();
    set({ loading: true });
    try {
      const uploadRes = await floorsApi.upload(currentProject.id, file, name);
      const floor = uploadRes.data;
      // Render thumbnail only (no wall detection)
      try {
        await floorsApi.render(floor.id);
        const floorsRes = await floorsApi.list(currentProject.id);
        const updatedFloor = floorsRes.data.find(f => f.id === floor.id) || floor;
        set({ floors: floorsRes.data, loading: false });
        return updatedFloor;
      } catch (processErr) {
        console.warn('Auto-process failed:', processErr);
        set(s => ({ floors: [...s.floors, floor], loading: false }));
        return floor;
      }
    } catch (e) { set({ error: e.message, loading: false }); throw e; }
  },

  selectFloor: async (floor) => {
    set({ currentFloor: floor, walls: [], accessPoints: [], shelvingZones: [], pixelsPerMeter: floor?.pixels_per_meter || 0 });
    if (floor) {
      const [wallsRes, apsRes] = await Promise.all([
        floorsApi.getWalls(floor.id),
        apsApi.list(floor.id),
      ]);
      const zonesRes = await shelvingZonesApi.list(floor.id).catch(() => ({ data: [] }));
      set({ walls: wallsRes.data, accessPoints: apsRes.data, shelvingZones: zonesRes.data });
    }
  },

  processFloor: async () => {
    const { currentFloor, currentProject } = get();
    if (!currentFloor) return;
    set({ loading: true });
    try {
      const res = await floorsApi.process(currentFloor.id);
      const floorsRes = await floorsApi.list(currentProject.id);
      const updatedFloor = floorsRes.data.find(f => f.id === currentFloor.id) || currentFloor;
      set({
        walls: res.data.walls || res.data,
        floors: floorsRes.data,
        currentFloor: updatedFloor,
        loading: false,
      });
    } catch (e) { set({ error: e.message, loading: false }); }
  },

  // ── AP actions ─────────────────────────────────────────────────────────────
  placeAP: async (x, y, name) => {
    const { currentFloor } = get();
    const res = await apsApi.create(currentFloor.id, { x, y, name, model: 'AP3000' });
    set(s => ({ accessPoints: [...s.accessPoints, res.data] }));
  },

  updateAP: async (apId, updates) => {
    const { accessPoints } = get();
    const ap = accessPoints.find(a => a.id === apId);
    if (!ap) return;
    const merged = { ...ap, ...updates };
    const res = await apsApi.update(apId, merged);
    set(s => ({ accessPoints: s.accessPoints.map(a => a.id === apId ? res.data : a) }));
  },

  deleteAP: async (apId) => {
    await apsApi.delete(apId);
    set(s => ({ accessPoints: s.accessPoints.filter(a => a.id !== apId) }));
  },

  // ── Tool actions ───────────────────────────────────────────────────────────
  setActiveTool: (tool) => set({ activeTool: tool, drawingWallStart: null, scalePoint1: null, scalePoint2: null, currentGroupId: null }),
  setSelectedMaterial: (materialId) => set({ selectedMaterial: materialId }),
  setSelectedFrequency: (freq) => set({ selectedFrequency: freq }),
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  toggleHeatmap: () => set(s => ({ showHeatmap: !s.showHeatmap })),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setSelectedZoneType: (type) => set({ selectedZoneType: type }),

  // ── Scale calibration actions ──────────────────────────────────────────────
  setScalePoint1: (pt) => set({ scalePoint1: pt }),
  setScalePoint2: (pt) => set({ scalePoint2: pt }),
  applyScale: async (realDistanceMeters) => {
    const { scalePoint1, scalePoint2, currentFloor } = get();
    if (!scalePoint1 || !scalePoint2 || !currentFloor) return;
    const dx = scalePoint2.x - scalePoint1.x;
    const dy = scalePoint2.y - scalePoint1.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    const ppm = pixelDistance / realDistanceMeters;
    // Save to backend
    await floorsApi.setScale(currentFloor.id, ppm);
    set({ pixelsPerMeter: ppm, scalePoint1: null, scalePoint2: null, activeTool: 'select' });
  },

  // ── Wall drawing actions ───────────────────────────────────────────────────
  setDrawingWallStart: (pt) => set({ drawingWallStart: pt }),
  startNewGroup: () => {
    const id = (crypto.randomUUID ?? (() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); })))();
    set({ currentGroupId: id });
    return id;
  },
  stopGroup: () => set({ currentGroupId: null, drawingWallStart: null }),

  addWall: async (x1, y1, x2, y2) => {
    const { currentFloor, selectedMaterial, currentGroupId, startNewGroup } = get();
    if (!currentFloor) return;
    const { getMaterial } = await import('../lib/wallMaterials.js');
    const mat = getMaterial(selectedMaterial);
    // Reuse existing group or start a new one (first segment of a chain)
    const groupId = currentGroupId || startNewGroup();
    const data = {
      x1, y1, x2, y2,
      thickness: mat.thickness,
      wall_type: mat.id,
      attenuation_db: mat.attenuation_24,
      attenuation_5ghz: mat.attenuation_5,
      group_id: groupId,
    };
    const res = await wallsApi.create(currentFloor.id, data);
    // Keep drawingWallStart for chaining — handled in FloorCanvas
    set(s => ({ walls: [...s.walls, res.data] }));
  },

  deleteWall: async (wallId) => {
    // If wall belongs to a group, delete the whole group
    const { walls } = get();
    const wall = walls.find(w => w.id === wallId);
    if (wall?.group_id) {
      await wallsApi.deleteGroup(wall.group_id);
      set(s => ({ walls: s.walls.filter(w => w.group_id !== wall.group_id) }));
    } else {
      await wallsApi.delete(wallId);
      set(s => ({ walls: s.walls.filter(w => w.id !== wallId) }));
    }
  },

  // ── Shelving Zone actions ──────────────────────────────────────────────────
  addShelvingZone: async (x, y, width, height, zoneType, attenuation_db, attenuation_5ghz) => {
    const { currentFloor } = get();
    if (!currentFloor) return;
    const res = await shelvingZonesApi.create(currentFloor.id, {
      x, y, width, height,
      zone_type: zoneType,
      attenuation_db,
      attenuation_5ghz,
    });
    set(s => ({ shelvingZones: [...s.shelvingZones, res.data] }));
  },

  deleteShelvingZone: async (zoneId) => {
    await shelvingZonesApi.delete(zoneId);
    set(s => ({ shelvingZones: s.shelvingZones.filter(z => z.id !== zoneId) }));
  },

  // ── Utility ────────────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),
}));

export default useStore;
