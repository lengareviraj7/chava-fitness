import api from './axios.js';

export const billingApi = {
  getQuote: (data) => api.post('/billing/quote', data),
  checkout: (data) => api.post('/billing/checkout', data),
  listBills: (params) => api.get('/billing/bills', { params }),
  getBillById: (id) => api.get(`/billing/bills/${id}`),
  voidBill: (id, data) => api.post(`/billing/bills/${id}/void`, data),
  deleteBill: (id, data) => api.delete(`/billing/bills/${id}`, { data }),
  editBill: (id, data) => api.patch(`/billing/bills/${id}`, data),
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
