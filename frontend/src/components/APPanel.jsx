import React from 'react';
import useStore from '../store/useStore';

export default function APPanel() {
  const { accessPoints, deleteAP, currentFloor } = useStore();
  if (!currentFloor) return null;
  return (
    <div style={{ width: 220, background: '#0d1b2a', borderLeft: '1px solid #1a3a5a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 14px', borderBottom: '1px solid #1a3a5a' }}>
        <p style={{ color: '#4a9eff', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Access Points ({accessPoints.length})
        </p>
      </div>
      <p style={{ color: '#555', fontSize: 11, padding: '8px 14px' }}>Clicca sul canvas per posizionare un AP</p>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {accessPoints.map(ap => (
          <div key={ap.id} style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: '#111d2e', border: '1px solid #1a3a5a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{ap.name}</p>
              <p style={{ fontSize: 11, color: '#555' }}>AP3000 ({Math.round(ap.x)}, {Math.round(ap.y)})</p>
            </div>
            <button onClick={() => deleteAP(ap.id)} style={{ background: '#c0392b', color: '#fff', padding: '4px 8px', fontSize: 11 }}>x</button>
          </div>
        ))}
      </div>
    </div>
  );
}
