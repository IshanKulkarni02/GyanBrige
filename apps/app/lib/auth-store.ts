import { create } from 'zustand';
import { api, tokenStore } from './api';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'STAFF' | 'CLUB_LEAD';

export interface Me {
  id: string;
  email: string | null;
  name: string;
  avatar: string | null;
  roles: { role: Role; scopeId: string | null }[];
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string, inviteToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: true,
  hydrate: async () => {
    set({ loading: true });
    const token = await tokenStore.get();
    if (!token) return set({ me: null, loading: false });
    try {
      const me = await api<Me>('/api/auth/me');
      set({ me, loading: false });
    } catch {
      await tokenStore.del();
      set({ me: null, loading: false });
    }
  },
  login: async (email, password) => {
    const r = await api<{ token: string; user: { id: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    await tokenStore.set(r.token);
    const me = await api<Me>('/api/auth/me');
    set({ me });
  },
  signup: async (email, name, password, inviteToken) => {
    const r = await api<{ token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, inviteToken }),
      auth: false,
    });
    await tokenStore.set(r.token);
    const me = await api<Me>('/api/auth/me');
    set({ me });
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await tokenStore.del();
    set({ me: null });
  },
}));
