// Wall material definitions with RF attenuation values
// Attenuation values from iBwave, NIST, and industry standards

const WALL_MATERIALS = [
  { id: 'drywall',      name: 'Cartongesso',        color: '#4CAF50', thickness: 3, attenuation_24: 3,  attenuation_5: 5  },
  { id: 'wood',         name: 'Legno',              color: '#66BB6A', thickness: 4, attenuation_24: 4,  attenuation_5: 6  },
  { id: 'glass',        name: 'Vetro',              color: '#81C784', thickness: 2, attenuation_24: 2,  attenuation_5: 4  },
  { id: 'glass_lowe',   name: 'Vetro Low-E',        color: '#2E7D32', thickness: 2, attenuation_24: 10, attenuation_5: 25 },
  { id: 'brick',        name: 'Mattone',            color: '#388E3C', thickness: 5, attenuation_24: 8,  attenuation_5: 15 },
  { id: 'concrete',     name: 'Cemento',            color: '#43A047', thickness: 6, attenuation_24: 12, attenuation_5: 25 },
  { id: 'concrete_heavy', name: 'Cemento Armato',   color: '#1B5E20', thickness: 8, attenuation_24: 23, attenuation_5: 45 },
  { id: 'metal',        name: 'Metallo',            color: '#2E7D32', thickness: 5, attenuation_24: 40, attenuation_5: 50 },
  { id: 'door_wood',    name: 'Porta (Legno)',      color: '#A5D6A7', thickness: 3, attenuation_24: 3,  attenuation_5: 5,  dashed: true },
  { id: 'door_metal',   name: 'Porta (Metallo)',    color: '#69F0AE', thickness: 3, attenuation_24: 15, attenuation_5: 20, dashed: true },
  { id: 'window',       name: 'Finestra',           color: '#B9F6CA', thickness: 2, attenuation_24: 2,  attenuation_5: 3  },
  // ── Scaffalature supermercato ───────────────────────────────────────────────
  { id: 'shelf_empty',  name: '🛒 Scaffale vuoto',  color: '#f39c12', thickness: 2, attenuation_24: 5,  attenuation_5: 8  },
  { id: 'shelf_full',   name: '🛒 Scaffale pieno',  color: '#e67e22', thickness: 2, attenuation_24: 12, attenuation_5: 20 },
  { id: 'shelf_wet',    name: '🛒 Scaffale freschi', color: '#3498db', thickness: 2, attenuation_24: 16, attenuation_5: 28 },
];

export const getMaterial = (id) => WALL_MATERIALS.find(m => m.id === id) || WALL_MATERIALS[0];
export const getDefaultMaterial = () => WALL_MATERIALS.find(m => m.id === 'concrete');
export default WALL_MATERIALS;
