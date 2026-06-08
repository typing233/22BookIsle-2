import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  role: string;
  display_name: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!accessToken.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      accessToken.value = res.data.accessToken;
      refreshToken.value = res.data.refreshToken;
      user.value = res.data.user;

      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      return true;
    } catch {
      return false;
    }
  }

  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false;
    try {
      const res = await axios.post('/api/auth/refresh', { refreshToken: refreshToken.value });
      accessToken.value = res.data.accessToken;
      localStorage.setItem('accessToken', res.data.accessToken);
      return true;
    } catch {
      logout();
      return false;
    }
  }

  function logout() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  return { accessToken, refreshToken, user, isAuthenticated, isAdmin, login, refresh, logout };
});
