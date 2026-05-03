import { create } from 'zustand';
import { api } from '../services/api';

export const useAreaStore = create((set, get) => ({
  areas: [],
  activeArea: null, // null = All

  fetch: async () => {
    try {
      const data = await api.getAreas();
      set({ areas: data.areas });
    } catch (e) {
      console.error('Failed to fetch areas:', e);
    }
  },

  setActive: (areaId) => set({ activeArea: areaId }),

  create: async (name, color) => {
    const data = await api.createArea({ name, color });
    set(s => ({ areas: [...s.areas, data.area] }));
    return data.area;
  },

  update: async (id, updates) => {
    const data = await api.updateArea(id, updates);
    set(s => ({ areas: s.areas.map(a => a.id === id ? data.area : a) }));
  },

  remove: async (id) => {
    await api.deleteArea(id);
    set(s => ({
      areas: s.areas.filter(a => a.id !== id),
      activeArea: s.activeArea === id ? null : s.activeArea,
    }));
  },

  getById: (id) => get().areas.find(a => a.id === id),
}));
