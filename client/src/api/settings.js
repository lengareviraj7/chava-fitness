import api from './axios.js';

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  deactivate: (id) => api.patch(`/users/${id}/deactivate`),
  activate: (id) => api.patch(`/users/${id}/activate`),
  resetPassword: (id, password) => api.patch(`/users/${id}/reset-password`, { password }),
  setPin: (id, pin) => api.patch(`/users/${id}/set-pin`, { pin }),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};
