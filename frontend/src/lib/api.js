import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const projectsApi = {
  list: () => api.get('/projects'),
  create: (data) => api.post('/projects', data),
  get: (id) => api.get(`/projects/${id}`),
  delete: (id) => api.delete(`/projects/${id}`),
};

export const floorsApi = {
  list: (projectId) => api.get(`/projects/${projectId}/floors`),
  upload: (projectId, file, name) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    return api.post(`/projects/${projectId}/floors`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  process: (floorId) => api.post(`/floors/${floorId}/process`),
  render: (floorId) => api.post(`/floors/${floorId}/render`),
  getWalls: (floorId) => api.get(`/floors/${floorId}/walls`),
  setScale: (floorId, pixelsPerMeter) => api.put(`/floors/${floorId}/scale`, { pixels_per_meter: pixelsPerMeter }),
  delete: (floorId) => api.delete(`/floors/${floorId}`),
};

export const apsApi = {
  list: (floorId) => api.get(`/floors/${floorId}/access-points`),
  create: (floorId, data) => api.post(`/floors/${floorId}/access-points`, data),
  update: (apId, data) => api.put(`/access-points/${apId}`, data),
  delete: (apId) => api.delete(`/access-points/${apId}`),
};

export const wallsApi = {
  list: (floorId) => api.get(`/floors/${floorId}/walls`),
  create: (floorId, data) => api.post(`/floors/${floorId}/walls`, data),
  update: (wallId, data) => api.put(`/walls/${wallId}`, data),
  delete: (wallId) => api.delete(`/walls/${wallId}`),
  deleteGroup: (groupId) => api.delete(`/wall-groups/${groupId}`),
};

export const shelvingZonesApi = {
  list: (floorId) => api.get(`/floors/${floorId}/shelving-zones`),
  create: (floorId, data) => api.post(`/floors/${floorId}/shelving-zones`, data),
  delete: (zoneId) => api.delete(`/shelving-zones/${zoneId}`),
};
