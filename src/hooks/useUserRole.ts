import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';

export const useUserRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const checkRole = async () => {
      setIsLoading(true);
      
      if (!isLoaded) {
        console.log('[useUserRole] Clerk not loaded yet');
        return;
      }
      
      if (!user) {
        console.log('[useUserRole] No user logged in');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      console.log('[useUserRole] Checking role for Clerk user:', user.id);

      // Check admin role in Supabase using Clerk user ID (TEXT type)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      console.log('[useUserRole] Query result:', { data, error });

      if (error) {
        console.error('[useUserRole] Error checking role:', error);
        setIsAdmin(false);
      } else {
        const hasAdminRole = !!data;
        console.log('[useUserRole] Is admin:', hasAdminRole);
        setIsAdmin(hasAdminRole);
      }
      
      setIsLoading(false);
    };

    checkRole();
  }, [user, isLoaded]);

  return { isAdmin, isLoading, userId: user?.id ?? null };
};
