'use client';

import { create } from 'zustand';
import type { Profile } from '@/types';

interface AppState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;
  sidebarOpen: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  sidebarOpen: false,
  setUser: (user) => set({ user, loading: false, initialized: true }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  reset: () => set({ user: null, loading: false, initialized: true, sidebarOpen: false }),
}));
