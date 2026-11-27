import api from './axios.js';

export const authApi = {
  login: (phone, password) => api.post('/auth/login', { phone, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};
