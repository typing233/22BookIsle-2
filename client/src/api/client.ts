import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore();

    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      try {
        const refreshed = await authStore.refresh();
        if (refreshed) {
          error.config.headers.Authorization = `Bearer ${authStore.accessToken}`;
          return api(error.config);
        }
      } catch {
        authStore.logout();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
