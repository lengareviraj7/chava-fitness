import api from './axios.js';

export const stockApi = {
  list: (params) => api.get('/stock', { params }),
  getVariant: (variantId) => api.get(`/stock/variants/${variantId}`),
  adjust: (data) => api.post('/stock/adjustments', data),
  getAlerts: () => api.get('/stock/alerts'),
};

export const purchasesApi = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  void: (id, reason) => api.post(`/purchases/${id}/void`, { reason }),
};

export const suppliersApi = {
  list: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  getSummary: (id) => api.get(`/suppliers/${id}/summary`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  recordPayment: (data) => api.post('/suppliers/payments', data),
};
