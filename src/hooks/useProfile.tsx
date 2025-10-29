import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  name: string;
  status: string;
  photo_url: string | null;
  nome_colete: string | null;
  profile_status: string;
  observacao: string | null;
}

export const useProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setHasFetched(false);
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // DEBUG: Log fetch results
      console.log('🔍 useProfile fetch:', {
        userId,
        data,
        error,
        hasData: !!data
      });

      if (error) {
        console.error('❌ Error fetching profile:', error);
      } else {
        setProfile(data);
      }
      setLoading(false);
      setHasFetched(true);
    };

    if (!hasFetched) {
      fetchProfile();
    }

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔄 Profile updated via realtime:', payload);
          if (payload.eventType === 'DELETE') {
            setProfile(null);
          } else {
            setProfile(payload.new as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, hasFetched]);

  return { profile, loading };
};
