import { createInternalNeonAuth } from '@neondatabase/neon-js/auth';

const AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL as string;

if (!AUTH_URL) {
  throw new Error('VITE_NEON_AUTH_URL not set');
}

const neonAuth = createInternalNeonAuth(AUTH_URL);

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
  const result: any = await authClient.getSession();
  const data = result?.data ?? null;

  return {
    session: data?.session ?? null,
    user: normalizeUser(data),
    token: normalizeToken(data),
    raw: result,
  };
}

export async function getNeonUser(): Promise<NeonUser | null> {
  const { user } = await getNeonSession();
  return user;
}

export async function getNeonAccessToken(): Promise<string | null> {
  return (await neonAuth.getJWTToken()) ?? (await getNeonSession()).token;
}

export async function signOutNeon() {
  await authClient.signOut();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('storage'));
  }
}

export default authClient;
