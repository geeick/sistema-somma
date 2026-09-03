import { getNeonAccessToken } from '@/lib/auth';
import { getAccessToken as getLegacyAccessToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const GET_CACHE_TTL = 30_000;
const responseCache = new Map<string, { value: unknown; expiresAt: number }>();
const pendingRequests = new Map<string, Promise<unknown>>();
const creatorPreloadTimes = new Map<string, number>();

function readCachedResponse<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value as T;
}

async function cachedGet<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = readCachedResponse<T>(key);
  if (cached) return cached;

  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;

  const requestPromise = load()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL });
      return value;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, requestPromise);
  return requestPromise;
}

async function publicRequest(path: string, options: RequestInit = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const load = async () => {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || 'API error');
    return json;
  };
  return method === 'GET' ? cachedGet(`public:${path}`, load) : load();
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (await getNeonAccessToken()) ?? getLegacyAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const method = String(options.method || 'GET').toUpperCase();
  const load = async () => {
    const res = await fetch(API_BASE + path, { ...options, headers });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || 'API error');
    if (method !== 'GET') responseCache.clear();
    return json;
  };
  const cacheKey = `auth:${token || 'anonymous'}:${path}`;
  return method === 'GET' ? cachedGet(cacheKey, load) : load();
}

export async function getSession() {
  const res = await request('/api/session', { method: 'GET' });
  return res.data;
}

export const pages = {
  async list() {
    const res = await request('/api/pages');
    return res.data;
  },
  async create(payload: any) {
    const res = await request('/api/pages', { method: 'POST', body: JSON.stringify(payload) });
    return res.data;
  },
  async remove(id: string) {
    const res = await request(`/api/pages/${id}`, { method: 'DELETE' });
    return res;
  }
};

export const wallet = {
  async profile() {
    const res = await request('/api/profile');
    return res.data;
  },
  async withdrawals() {
    const res = await request('/api/withdrawals');
    return res.data;
  },
  async requestWithdrawal(payload: any) {
    const res = await request('/api/withdrawals', { method: 'POST', body: JSON.stringify(payload) });
    return res.data;
  }
};

export const campaigns = {
  async active() {
    const res = await publicRequest('/api/campaigns/active');
    return res.data;
  },
};

export const tables = {
  async list(table: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) search.set(key, String(value));
    });
    const query = search.toString();
    const res = await request(`/api/tables/${table}${query ? `?${query}` : ''}`);
    return res.data;
  },
  async create(table: string, payload: any) {
    const res = await request(`/api/tables/${table}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
  async remove(table: string, params: Record<string, string | number | boolean>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
    const res = await request(`/api/tables/${table}?${search.toString()}`, {
      method: 'DELETE',
    });
    return res;
  },
};

export async function preloadCreatorData(userId: string) {
  const lastPreload = creatorPreloadTimes.get(userId) || 0;
  if (Date.now() - lastPreload < 60_000) return;
  creatorPreloadTimes.set(userId, Date.now());

  await Promise.allSettled([
    campaigns.active(),
    pages.list(),
    wallet.profile(),
    wallet.withdrawals(),
    tables.list('submissions', { user_id: userId }),
  ]);
}

export async function logError(payload: any) {
  await fetch(API_BASE + '/api/error-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export default { getSession, pages, wallet, campaigns, tables, logError };
