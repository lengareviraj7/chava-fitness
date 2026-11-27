import api from './axios.js';

export const billingApi = {
  getQuote: (data) => api.post('/billing/quote', data),
  checkout: (data) => api.post('/billing/checkout', data),
  listBills: (params) => api.get('/billing/bills', { params }),
  getBillById: (id) => api.get(`/billing/bills/${id}`),
  holdCart: (data) => api.post('/billing/hold', data),
  listHeld: () => api.get('/billing/hold'),
  recallHeld: (holdCode) => api.post(`/billing/hold/${holdCode}/recall`),
};

export const customersApi = {
  lookup: (q) => api.get('/customers/lookup', { params: { q } }),
  list: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
};
