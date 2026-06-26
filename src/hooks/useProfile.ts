'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/store/app-store';
import type { Profile } from '@/types';

export function useProfile() {
  const { user, loading, initialized, setUser } = useAppStore();
  const supabase = createClient();

  useEffect(() => {
    if (initialized) return;
    async function load() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          if (data) setUser(data as Profile);
          else setUser(null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }
    load();
  }, [supabase, initialized, setUser]);

  return { user, loading, initialized };
}
