import api from './axios.js';

export const customersApi = {
  lookup: (q) => api.get('/customers/lookup', { params: { q } }),
  list: (params = {}) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  getLedger: (id) => api.get(`/customers/${id}/ledger`),
  collectDue: (id, data) => api.post(`/customers/${id}/collect-due`, data),
  getReminders: () => api.get('/customers/reminders'),
  markReminderSent: (id) => api.post(`/customers/${id}/reminders/sent`),
};
