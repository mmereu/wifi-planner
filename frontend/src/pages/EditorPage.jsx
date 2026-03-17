import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Sidebar from '../components/Sidebar';
import FloorCanvas from '../components/FloorCanvas';
import APPanel from '../components/APPanel';
import { projectsApi } from '../lib/api';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, currentFloor, processFloor, loading, error, clearError } = useStore();

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
        <div style={{ background: '#0f3460', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1a4a8a' }}>
          <button onClick={() => navigate('/')} style={{ background: '#1a4a8a', color: '#ccc', padding: '6px 12px', fontSize: 13 }}>← Progetti</button>
          <span style={{ color: '#4a9eff', fontWeight: 600 }}>{currentProject?.name || '...'}</span>
          {currentFloor && (
            <>
              <span style={{ color: '#555' }}>›</span>
              <span style={{ color: '#ccc', fontSize: 14 }}>{currentFloor.name}</span>
              <button
                onClick={processFloor}
                disabled={loading}
                style={{ background: loading ? '#555' : '#27ae60', color: '#fff', marginLeft: 8 }}
              >
                {loading ? 'Elaborazione...' : '🔍 Riconosci Muri'}
              </button>
            </>
          )}
          {error && (
            <span style={{ color: '#e74c3c', fontSize: 13 }}>{error} <button onClick={clearError} style={{ background: 'none', color: '#e74c3c', padding: '2px 6px', border: '1px solid #e74c3c', fontSize: 11 }}>✕</button></span>
          )}
        </div>
        {/* Canvas area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <FloorCanvas />
          <APPanel />
        </div>
      </div>
    </div>
  );
}
