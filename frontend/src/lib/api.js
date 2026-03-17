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
  getWalls: (floorId) => api.get(`/floors/${floorId}/walls`),
  delete: (floorId) => api.delete(`/floors/${floorId}`),
};

export const apsApi = {
  list: (floorId) => api.get(`/floors/${floorId}/access-points`),
  create: (floorId, data) => api.post(`/floors/${floorId}/access-points`, data),
  delete: (apId) => api.delete(`/access-points/${apId}`),
};
