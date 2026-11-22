// Signed-in session: user, business, chat credentials and server features.
import { create } from 'zustand';
import { api, getToken, onUnauthorized, setToken } from '../lib/api';

export interface SessionUser {
  id: string;
  phone?: string;
  name: string | null;
  language: string;
  business_id?: string | null;
  role?: string; // 'owner' | 'agent'
  onboarded?: number | boolean;
  is_seed?: number;
  [k: string]: unknown;
}

export interface SessionBusiness {
  id: string;
  slug?: string;
  name: string;
  ownerName?: string;
  language?: string;
  city?: string;
  accent?: string;
  role?: string;
  sells?: string[];
  buys?: string[];
  isDemo?: boolean;
  trust?: SessionTrust;
  [k: string]: unknown;
}

export interface SessionTrust {
  score: number;
  badges: string[];
  isNew?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
  onTimePct?: number | null;
  paysOnTime?: string | null;
  [k: string]: unknown;
}

export interface ChatCreds {
  mode: 'nexconn' | 'local';
  appKey: string;
  area: string;
  token: string | null;
}

export interface Features {
  nexconn?: boolean;
  llm?: boolean;
  sarvam?: boolean;
  /** Supply-chain module enabled for this business (docs/supply-chain, behind a flag). */
  supplyChain?: boolean;
  [k: string]: unknown;
}

export interface SessionPayload {
  token?: string;
  user?: SessionUser;
  business?: SessionBusiness | null;
  trust?: SessionTrust | null;
  chat?: ChatCreds;
  features?: Features;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  business: SessionBusiness | null;
  trust: SessionTrust | null;
  chat: ChatCreds | null;
  features: Features | null;
  /** True once /api/me has been checked at least once this page load. */
  ready: boolean;
  setSession: (p: SessionPayload) => void;
  setUser: (patch: Partial<SessionUser>) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const CACHE_KEY = 'cc_session';

function readCache(): Partial<SessionState> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SessionState>) : {};
  } catch {
    return {};
  }
}

function writeCache(s: Pick<SessionState, 'user' | 'business' | 'trust' | 'chat' | 'features'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user: s.user, business: s.business, trust: s.trust, chat: s.chat, features: s.features }));
  } catch {
    /* ignore */
  }
}

const token0 = getToken();
const cached = token0 ? readCache() : {};

export const useSession = create<SessionState>((set, get) => ({
  token: token0,
  user: (cached.user as SessionUser) ?? null,
  business: (cached.business as SessionBusiness) ?? null,
  trust: (cached.trust as SessionTrust) ?? null,
  chat: (cached.chat as ChatCreds) ?? null,
  features: (cached.features as Features) ?? null,
  ready: !token0,

  setSession: (p) => {
    if (p.token !== undefined) setToken(p.token);
    set((s) => ({
      token: p.token ?? s.token,
      user: p.user ?? s.user,
      business: p.business !== undefined ? p.business : s.business,
      trust: p.trust !== undefined ? p.trust : s.trust,
      chat: p.chat ?? s.chat,
      features: p.features ?? s.features,
      ready: true,
    }));
    writeCache(get());
  },

  setUser: (patch) => {
    const u = get().user;
    if (!u) return;
    set({ user: { ...u, ...patch } });
    writeCache(get());
  },

  refresh: async () => {
    if (!get().token) {
      set({ ready: true });
      return;
    }
    try {
      const me = await api.get<Required<Pick<SessionPayload, 'user' | 'chat'>> & SessionPayload>('/api/me');
      get().setSession({ user: me.user, business: me.business ?? null, trust: me.trust ?? null, chat: me.chat, features: me.features });
    } catch {
      // Network error: keep the cached session so the app still opens; 401 is handled below.
      set({ ready: true });
    }
  },

  logout: () => {
    setToken(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    set({ token: null, user: null, business: null, trust: null, chat: null, features: null, ready: true });
  },
}));

onUnauthorized(() => useSession.getState().logout());

/** Current UI / translation language. */
export const useLang = () => useSession((s) => s.user?.language || 'en');

export const isAgent = (u: SessionUser | null | undefined) => u?.role === 'agent';
export const isOnboarded = (u: SessionUser | null | undefined) => Boolean(u?.onboarded);
