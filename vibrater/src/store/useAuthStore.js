import { create } from 'zustand';
import { api } from '../services/api';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('vibrater_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('vibrater_access_token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login(email, password);
      localStorage.setItem('vibrater_access_token', data.accessToken);
      localStorage.setItem('vibrater_refresh_token', data.refreshToken);
      localStorage.setItem('vibrater_user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, loading: false });
      return true;
    } catch (error) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const data = await api.register(email, password, name);
      localStorage.setItem('vibrater_access_token', data.accessToken);
      localStorage.setItem('vibrater_refresh_token', data.refreshToken);
      localStorage.setItem('vibrater_user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, loading: false });
      return true;
    } catch (error) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear state and storage regardless of API call success
      localStorage.removeItem('vibrater_access_token');
      localStorage.removeItem('vibrater_refresh_token');
      localStorage.removeItem('vibrater_user');
      set({ user: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
