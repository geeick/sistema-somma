import { createInternalNeonAuth } from '@neondatabase/neon-js/auth';

const AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL as string;

if (!AUTH_URL) {
  throw new Error('VITE_NEON_AUTH_URL not set');
}

const neonAuth = createInternalNeonAuth(AUTH_URL);

const AUTH_CACHE_TTL = 20_000;
let cachedSession: { value: NeonSessionState; expiresAt: number } | null = null;
let sessionRequest: Promise<NeonSessionState> | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string | null> | null = null;

export const authClient = neonAuth.adapter;

export type NeonUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  [key: string]: unknown;
};

export type NeonSessionState = {
  session: Record<string, unknown> | null;
  user: NeonUser | null;
  token: string | null;
  raw: unknown;
};

function normalizeUser(data: any): NeonUser | null {
  const user = data?.user ?? data?.session?.user ?? null;
  if (!user) return null;

  const id =
    user.id ??
    user.sub ??
    data?.session?.userId ??
    data?.session?.user_id ??
    data?.session?.sub;

  if (!id) return null;

  return {
    ...user,
    id,
    email: user.email ?? data?.session?.email ?? null,
  };
}

function normalizeToken(data: any): string | null {
  return (
    data?.session?.token ??
    data?.session?.access_token ??
    data?.access_token ??
    data?.token ??
    null
  );
}

export async function getNeonSession(): Promise<NeonSessionState> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession.value;
  if (sessionRequest) return sessionRequest;

  sessionRequest = (async () => {
    const result: any = await authClient.getSession();
    const data = result?.data ?? null;
    const value = {
      session: data?.session ?? null,
      user: normalizeUser(data),
      token: normalizeToken(data),
      raw: result,
    };

    // A signed-out result is intentionally not cached so a fresh login is visible immediately.
    if (value.user) cachedSession = { value, expiresAt: Date.now() + AUTH_CACHE_TTL };
    return value;
  })().finally(() => {
    sessionRequest = null;
  });

  return sessionRequest;
}

export async function getNeonUser(): Promise<NeonUser | null> {
  const { user } = await getNeonSession();
  return user;
}

export async function getNeonAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const token = (await neonAuth.getJWTToken()) ?? (await getNeonSession()).token;
    if (token) cachedToken = { value: token, expiresAt: Date.now() + AUTH_CACHE_TTL };
    return token;
  })().finally(() => {
    tokenRequest = null;
  });

  return tokenRequest;
}

export async function signOutNeon() {
  cachedSession = null;
  cachedToken = null;
  await authClient.signOut();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('storage'));
  }
}

export default authClient;
