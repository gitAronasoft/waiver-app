import axios from 'axios';
import { BACKEND_URL } from '../config';

const axiosInstance = axios.create({
  baseURL: BACKEND_URL
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't auto-redirect for password change endpoints - let component handle it
    const isPasswordChangeEndpoint = error.config?.url?.includes('/change-password');

    if (error.response?.status === 401 && !isPasswordChangeEndpoint) {
      // Clear local storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('staff');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;