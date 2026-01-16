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
      
      if (!isLoaded || !user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Check admin role in Supabase using Clerk user ID
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
      
      setIsLoading(false);
    };

    checkRole();
  }, [user, isLoaded]);

  return { isAdmin, isLoading, userId: user?.id ?? null };
};
