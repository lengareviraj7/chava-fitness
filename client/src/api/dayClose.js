import api from './axios.js';

export const dayCloseApi = {
  getSummary: (params = {}) => api.get('/day-close/summary', { params }),
  addCashEntry: (data) => api.post('/day-close/cash-entry', data),
  closeDay: (data) => api.post('/day-close/close', data),
  getHistory: (params = {}) => api.get('/day-close/history', { params }),
};
