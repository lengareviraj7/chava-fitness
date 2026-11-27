import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookie
  timeout: 15000,
});

// Global response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // On 401, redirect to login (except on /auth endpoints)
    if (err.response?.status === 401 && !err.config.url.includes('/auth')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
