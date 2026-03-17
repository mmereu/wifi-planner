import { create } from 'zustand';
import { projectsApi, floorsApi, apsApi } from '../lib/api';

const useStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  floors: [],
  currentFloor: null,
  walls: [],
  accessPoints: [],
  loading: false,
  error: null,

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

  uploadFloor: async (file, name) => {
    const { currentProject } = get();
    set({ loading: true });
    try {
      const uploadRes = await floorsApi.upload(currentProject.id, file, name);
      const floor = uploadRes.data;
      // Auto-process to generate thumbnail PNG
      try {
        await floorsApi.process(floor.id);
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
    set({ currentFloor: floor, walls: [], accessPoints: [] });
    if (floor) {
      const [wallsRes, apsRes] = await Promise.all([
        floorsApi.getWalls(floor.id),
        apsApi.list(floor.id),
      ]);
      set({ walls: wallsRes.data, accessPoints: apsRes.data });
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

  placeAP: async (x, y, name) => {
    const { currentFloor } = get();
    const res = await apsApi.create(currentFloor.id, { x, y, name, model: 'AP3000' });
    set(s => ({ accessPoints: [...s.accessPoints, res.data] }));
  },

  deleteAP: async (apId) => {
    await apsApi.delete(apId);
    set(s => ({ accessPoints: s.accessPoints.filter(a => a.id !== apId) }));
  },

  clearError: () => set({ error: null }),
}));

export default useStore;
