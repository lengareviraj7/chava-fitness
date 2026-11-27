import api from './axios.js';

export const reportsApi = {
  getSales: (params = {}) => api.get('/reports/sales', { params }),
  getGstr1: (params = {}) => api.get('/reports/gstr-1', { params }),
  getStockValuation: () => api.get('/reports/stock-valuation'),
  getProfitLoss: (params = {}) => api.get('/reports/profit-loss', { params }),
  getDuesAging: () => api.get('/reports/dues-aging'),
  getFastSlowMoving: () => api.get('/reports/fast-slow-moving'),
};
