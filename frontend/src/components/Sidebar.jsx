import React, { useRef, useState } from 'react';
import useStore from '../store/useStore';

export default function Sidebar() {
  const { floors, currentFloor, selectFloor, uploadFloor, loading } = useStore();
  const fileRef = useRef();
  const [floorName, setFloorName] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const handleUpload = async () => {
    const file = fileRef.current.files[0];
    if (!file) return;
    const name = floorName.trim() || file.name.replace(/\.[^.]+$/, '');
    try {
      const floor = await uploadFloor(file, name);
      await selectFloor(floor);
      setShowUpload(false);
      setFloorName('');
    } catch (e) { alert('Errore upload: ' + e.message); }
  };

  return (
    <div style={{ width: 240, background: '#0d1b2a', borderRight: '1px solid #1a3a5a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 14px', borderBottom: '1px solid #1a3a5a' }}>
        <p style={{ color: '#4a9eff', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Piani</p>
        <button onClick={() => setShowUpload(!showUpload)} style={{ background: '#1a4a8a', color: '#ccc', width: '100%', padding: '8px', fontSize: 13 }}>
          + Carica Piano
        </button>
      </div>
      {showUpload && (
        <div style={{ padding: 12, borderBottom: '1px solid #1a3a5a', background: '#0f2a40' }}>
          <input placeholder="Nome piano" value={floorName} onChange={e => setFloorName(e.target.value)} style={{ marginBottom: 8, fontSize: 13 }} />
          <input ref={fileRef} type="file" accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg,.tiff,.webp"
            style={{ marginBottom: 8, fontSize: 12, color: '#aaa', background: 'none', border: 'none', padding: 0 }}
          />
          <button onClick={handleUpload} disabled={loading} style={{ background: '#27ae60', color: '#fff', width: '100%', fontSize: 13 }}>
            {loading ? 'Caricamento...' : 'Carica'}
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {floors.length === 0 && <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 }}>Nessun piano</p>}
        {floors.map(floor => (
          <div key={floor.id} onClick={() => selectFloor(floor)} style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
            background: currentFloor?.id === floor.id ? '#1a4a8a' : 'transparent',
            border: currentFloor?.id === floor.id ? '1px solid #4a9eff' : '1px solid transparent',
          }}>
            <p style={{ fontSize: 13, fontWeight: currentFloor?.id === floor.id ? 600 : 400 }}>{floor.name}</p>
            <p style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{floor.file_type?.toUpperCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
