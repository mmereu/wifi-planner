import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Sidebar from '../components/Sidebar';
import FloorCanvas from '../components/FloorCanvas';
import APPanel from '../components/APPanel';
import { projectsApi } from '../lib/api';
import WALL_MATERIALS from '../lib/wallMaterials';

const TOOLS = [
  { id: 'select',   label: 'Seleziona', icon: '↖' },
  { id: 'scale',    label: 'Scala',     icon: '📏' },
  { id: 'measure',  label: 'Righello',  icon: '📐' },
  { id: 'drawWall', label: 'Muro',      icon: '🧱' },
  { id: 'placeAP',  label: 'AP',        icon: '📡' },
];

const btnBase = {
  padding: '6px 12px',
  fontSize: 13,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject,
    currentFloor, processFloor,
    loading, error, clearError,
    activeTool, setActiveTool,
    selectedMaterial, setSelectedMaterial,
    pixelsPerMeter,
    showHeatmap, toggleHeatmap,
    selectedFrequency, setSelectedFrequency,
    heatmapMode, setHeatmapMode,
    accessPoints,
  } = useStore();

  useEffect(() => {
    const load = async () => {
      const res = await projectsApi.get(id);
      await setCurrentProject(res.data);
    };
    load().catch(() => navigate('/'));
  }, [id]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          background: '#0f3460', padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid #1a4a8a', flexWrap: 'wrap',
        }}>
          {/* Back + project name */}
          <button onClick={() => navigate('/')} style={{ ...btnBase, background: '#1a4a8a', color: '#ccc' }}>← Progetti</button>
          <span style={{ color: '#4a9eff', fontWeight: 600 }}>{currentProject?.name || '...'}</span>

          {currentFloor && (
            <>
              <span style={{ color: '#555' }}>›</span>
              <span style={{ color: '#ccc', fontSize: 14 }}>{currentFloor.name}</span>

              {/* Separator */}
              <div style={{ width: 1, height: 24, background: '#1a4a8a', margin: '0 4px' }} />

              {/* Tool buttons */}
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  style={{
                    ...btnBase,
                    background: activeTool === t.id ? '#2980b9' : '#1a4a8a',
                    color: activeTool === t.id ? '#fff' : '#aaa',
                    fontWeight: activeTool === t.id ? 600 : 400,
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}

              {/* Material picker (visible when drawWall is active) */}
              {activeTool === 'drawWall' && (
                <>
                  <div style={{ width: 1, height: 24, background: '#1a4a8a', margin: '0 4px' }} />
                  <select
                    value={selectedMaterial}
                    onChange={e => setSelectedMaterial(e.target.value)}
                    style={{
                      background: '#1a2744', color: '#ccc', border: '1px solid #2980b9',
                      borderRadius: 4, padding: '5px 8px', fontSize: 13,
                    }}
                  >
                    {WALL_MATERIALS.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.attenuation_24}/{m.attenuation_5} dB)
                      </option>
                    ))}
                  </select>
                  {/* Color swatch */}
                  <div style={{
                    width: 16, height: 16, borderRadius: 3,
                    background: (WALL_MATERIALS.find(m => m.id === selectedMaterial) || WALL_MATERIALS[0]).color,
                    border: '1px solid rgba(255,255,255,0.3)',
                  }} />
                </>
              )}

              {/* Separator */}
              <div style={{ width: 1, height: 24, background: '#1a4a8a', margin: '0 4px' }} />

              {/* Process / recognize button */}
              <button
                onClick={processFloor}
                disabled={loading}
                style={{ ...btnBase, background: loading ? '#555' : '#27ae60', color: '#fff' }}
              >
                {loading ? 'Elaborazione...' : 'Riconosci Muri'}
              </button>

              {/* Heatmap controls */}
              {accessPoints.length > 0 && (
                <>
                  <div style={{ width: 1, height: 24, background: '#1a4a8a', margin: '0 4px' }} />
                  <button
                    onClick={toggleHeatmap}
                    style={{
                      ...btnBase,
                      background: showHeatmap ? '#e53935' : '#1a4a8a',
                      color: showHeatmap ? '#fff' : '#aaa',
                      fontWeight: showHeatmap ? 600 : 400,
                    }}
                  >
                    {showHeatmap ? 'Nascondi Segnale' : 'Mostra Segnale'}
                  </button>
                  {showHeatmap && (
                    <>
                      <select
                        value={selectedFrequency}
                        onChange={e => setSelectedFrequency(e.target.value)}
                        style={{
                          background: '#1a2744', color: '#ccc', border: '1px solid #e53935',
                          borderRadius: 4, padding: '5px 8px', fontSize: 13,
                        }}
                      >
                        <option value="2.4">2.4 GHz</option>
                        <option value="5">5 GHz</option>
                      </select>
                      <select
                        value={heatmapMode}
                        onChange={e => setHeatmapMode(e.target.value)}
                        style={{
                          background: '#1a2744', color: '#ccc', border: '1px solid #1565c0',
                          borderRadius: 4, padding: '5px 8px', fontSize: 13,
                        }}
                      >
                        <option value="coverage">Copertura</option>
                        <option value="overlap">Overlap AP</option>
                      </select>
                    </>
                  )}
                </>
              )}

              {/* Scale info */}
              {pixelsPerMeter > 0 && (
                <span style={{ color: '#27ae60', fontSize: 12, marginLeft: 4 }}>
                  Scala: {pixelsPerMeter.toFixed(1)} px/m
                </span>
              )}
            </>
          )}

          {/* Error display */}
          {error && (
            <span style={{ color: '#e74c3c', fontSize: 13, marginLeft: 'auto' }}>
              {error}
              <button onClick={clearError} style={{ background: 'none', color: '#e74c3c', padding: '2px 6px', border: '1px solid #e74c3c', fontSize: 11, marginLeft: 6, cursor: 'pointer' }}>✕</button>
            </span>
          )}
        </div>

        {/* Canvas + AP panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <FloorCanvas />
          <APPanel />
        </div>
      </div>
    </div>
  );
}
