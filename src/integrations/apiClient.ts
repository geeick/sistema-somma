import { getNeonAccessToken } from '@/lib/auth';
import { getAccessToken as getLegacyAccessToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function publicRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'API error');
  return json;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (await getNeonAccessToken()) ?? getLegacyAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'API error');
  return json;
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

export async function logError(payload: any) {
  await fetch(API_BASE + '/api/error-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export default { getSession, pages, wallet, campaigns, tables, logError };
