import { create } from 'zustand';
import { api } from '../services/api.js';

interface UserInfo {
  id: string;
  nickname: string;
  avatar: string;
  isGuest: boolean;
}

interface AuthResponse {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;

  guestLogin: (nickname: string) => Promise<void>;
  register: (nickname: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

function saveTokens(data: AuthResponse) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  guestLogin: async (nickname: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/guest', { nickname });
      saveTokens(data);
      set({ user: data.user, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as { message?: string }).message || '登录失败', isLoading: false });
      throw err;
    }
  },

  register: async (nickname: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/register', {
        nickname,
        email,
        password,
      });
      saveTokens(data);
      set({ user: data.user, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as { message?: string }).message || '注册失败', isLoading: false });
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
      saveTokens(data);
      set({ user: data.user, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as { message?: string }).message || '登录失败', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, error: null });
  },

  loadUser: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await api.get<UserInfo>('/api/user/profile');
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isLoading: false });
    }
  },
}));
