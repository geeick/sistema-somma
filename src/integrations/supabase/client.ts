// Compatibility shim for existing code that imports the original Supabase client.
// It implements a minimal supabase-like interface using our `apiClient` and `auth` shims.
import { getNeonAccessToken, getNeonSession, signOutNeon } from '@/lib/auth';
import auth from '../auth';

async function getAuthHeaders() {
  const token = (await getNeonAccessToken()) ?? auth.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function makeFrom(table: string) {
  const filters: Record<string, any> = {};
  let orderBy: string | null = null;
  let single = false;

  return {
    eq(key: string, value: any) { filters[key] = value; return this; },
    order(field: string, _opts?: any) { orderBy = field; return this; },
    select(_cols?: string) {
      // call generic table endpoint
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k,v]) => params.set(k, String(v)));
      if (orderBy) params.set('order', orderBy);
      if (single) params.set('single', 'true');
      const url = `/api/tables/${table}?${params.toString()}`;
      return getAuthHeaders()
        .then((headers) => fetch((import.meta.env.VITE_API_BASE || '') + url, { headers }))
        .then(r => r.json())
        .then(json => ({ data: json.data, error: null }));
    },
    insert(payload: any) {
      return getAuthHeaders()
        .then((authHeaders) => fetch((import.meta.env.VITE_API_BASE || '') + `/api/tables/${table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload)
        }))
        .then(r => r.json()).then(json => ({ data: json.data, error: null }));
    },
    delete() {
      // will expect filters to include id or other fields
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k,v]) => params.set(k, String(v)));
      return getAuthHeaders()
        .then((headers) => fetch((import.meta.env.VITE_API_BASE || '') + `/api/tables/${table}?${params.toString()}`, { method: 'DELETE', headers }))
        .then(r => r.json()).then(json => ({ data: json, error: null }));
    },
    single() { single = true; return this; }
  };
}

export const supabase = {
  auth: {
    async getSession() {
      try {
        const { session, user, token } = await getNeonSession();
        return {
          data: {
            session: session ? { ...session, user, access_token: token } : null,
          },
          error: null,
        };
      } catch (err) { return { data: { session: null } }; }
    },
    onAuthStateChange(callback: any) {
      const unsubscribe = auth.onAuthStateChange((event: string, session: any) => callback(event, session));
      return { data: { subscription: { unsubscribe } } };
    },
    async getUser() {
      try {
        const { user } = await getNeonSession();
        return { data: { user }, error: null };
      } catch (err) { return { data: { user: null } } }
    }
    ,
    async signUp(payload: any) {
      try {
        // call dev signup endpoint
        const res = await fetch((import.meta.env.VITE_API_BASE || '') + '/auth/dev-signup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email })
        });
        const json = await res.json();
        if (json.access_token) {
          auth.setAccessToken(json.access_token);
          return { error: null };
        }
        return { error: { message: json.error || 'Signup failed' } };
      } catch (err: any) {
        return { error: { message: err.message || String(err) } };
      }
    },
    async signInWithPassword(payload: any) {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE || '') + '/auth/dev-signin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email })
        });
        const json = await res.json();
        if (json.access_token) {
          auth.setAccessToken(json.access_token);
          return { error: null };
        }
        return { error: { message: json.error || 'Sign in failed' } };
      } catch (err: any) {
        return { error: { message: err.message || String(err) } };
      }
    },
    async signOut() {
      try {
        await signOutNeon();
        return { error: null };
      } catch (err: any) {
        return { error: { message: err.message || String(err) } };
      }
    }
  },
  from(table: string) {
    return makeFrom(table);
  }
};

export default supabase;
