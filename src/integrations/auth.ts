// Minimal auth shim for frontend when using Neon Auth + Express API
// This file stores the access token in localStorage under 'auth_token' after login.

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
  // trigger storage event for same-window listeners
  window.dispatchEvent(new Event('storage'));
}

export function getAccessToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function getSessionFromStorage() {
  const token = getAccessToken();
  if (!token) return { data: { session: null } };
  // We don't decode user here — server session endpoint will provide it
  return { data: { session: { access_token: token, user: null } } };
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const handler = () => {
    const sess = getSessionFromStorage();
    callback('storage', sess.data.session);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function signOut() {
  setAccessToken(null);
}

export default { setAccessToken, getAccessToken, getSessionFromStorage, onAuthStateChange, signOut };
