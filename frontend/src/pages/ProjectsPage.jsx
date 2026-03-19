import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';

export default function ProjectsPage() {
  const { projects, fetchProjects, createProject, deleteProject, loading } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const p = await createProject(name.trim(), desc.trim());
    setName(''); setDesc(''); setShowForm(false);
    navigate(`/projects/${p.id}`);
  };

  return (
    <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#4a9eff' }}>Wifi Planner by Marcone</h1>
        <button onClick={() => setShowForm(true)} style={{ background: '#4a9eff', color: '#fff', padding: '10px 20px' }}>
          + Nuovo Progetto
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#16213e', border: '1px solid #2a2a5e', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Nuovo Progetto</h3>
          <form onSubmit={handleCreate}>
            <input placeholder="Nome progetto *" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 12 }} />
            <input placeholder="Descrizione (opzionale)" value={desc} onChange={e => setDesc(e.target.value)} style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ background: '#4a9eff', color: '#fff' }}>Crea</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: '#444', color: '#fff' }}>Annulla</button>
            </div>
          </form>
        </div>
      )}

      {loading && <p style={{ color: '#888' }}>Caricamento...</p>}

      {projects.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
          <p style={{ fontSize: 18 }}>Nessun progetto ancora</p>
          <p style={{ marginTop: 8 }}>Crea il tuo primo progetto per iniziare</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {projects.map(p => (
          <div key={p.id} style={{ background: '#16213e', border: '1px solid #2a2a5e', borderRadius: 10, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</h3>
              {p.description && <p style={{ color: '#888', fontSize: 13 }}>{p.description}</p>}
              <p style={{ color: '#555', fontSize: 12, marginTop: 4 }}>{new Date(p.created_at).toLocaleDateString('it-IT')}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/projects/${p.id}`)} style={{ background: '#4a9eff', color: '#fff' }}>Apri</button>
              <button onClick={() => deleteProject(p.id)} style={{ background: '#c0392b', color: '#fff' }}>Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
