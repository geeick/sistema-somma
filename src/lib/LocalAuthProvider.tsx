import React, { useEffect, useState, useCallback } from 'react';
import { getNeonSession, signOutNeon, type NeonUser } from '@/lib/auth';

export const LocalAuthContext = React.createContext<{
  user: NeonUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}>({ user: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export const LocalAuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<NeonUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { user } = await getNeonSession();
      setUser(user);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutNeon();
    setUser(null);
  }, []);

  return (
    <LocalAuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </LocalAuthContext.Provider>
  );
};

export default LocalAuthProvider;
