import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface UIState {
  activeProjectId: number | null;
  theme: 'dark' | 'light';
  toast: ToastMessage | null;
  installPrompt: any | null;
  isInstallable: boolean;
  setActiveProjectId: (id: number | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setInstallPrompt: (prompt: any) => void;
}

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('projectpilot_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const useUIStore = create<UIState>((set, get) => ({
  activeProjectId: null,
  theme: getInitialTheme(),
  toast: null,
  installPrompt: null,
  isInstallable: false,

  setActiveProjectId: (id) => {
    set({ activeProjectId: id });
    if (id !== null) {
      localStorage.setItem('projectpilot_active_project', String(id));
    }
  },

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('projectpilot_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  showToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    set({ toast: { id, message, type } });
    setTimeout(() => {
      const current = get().toast;
      if (current && current.id === id) {
        set({ toast: null });
      }
    }, 3200);
  },

  clearToast: () => set({ toast: null }),

  setInstallPrompt: (prompt) => {
    set({ installPrompt: prompt, isInstallable: Boolean(prompt) });
  },
}));
