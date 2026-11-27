import api from './axios.js';

export const returnsApi = {
  preview: (data) => api.post('/returns/preview', data),
  create: (data) => api.post('/returns', data),
  list: (params = {}) => api.get('/returns', { params }),
  getById: (id) => api.get(`/returns/${id}`),
};
