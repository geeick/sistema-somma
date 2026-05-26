import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'finance' | 'creator';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('creator'); // Default to creator
        } else {
          setRole(data.role as UserRole);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRole('creator');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserRole();
  }, []);

  return { role, isLoading, isAdmin: role === 'admin', isFinance: role === 'finance', isCreator: role === 'creator' };
}
