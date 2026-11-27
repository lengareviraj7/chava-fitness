import api from './axios.js';

export const productsApi = {
  list: (params = {}) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  toggleActive: (id) => api.patch(`/products/${id}/toggle-active`),
  delete: (id) => api.delete(`/products/${id}`),
  getSimilar: (params = {}) => api.get('/products/similar', { params }),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const brandsApi = {
  list: () => api.get('/products/brands'),
};
