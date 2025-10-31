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
  telefone: string | null;
  integrante?: {
    vinculado: boolean;
    cargo_nome: string;
    grau: string;
  } | null;
}

export const useProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          integrante:integrantes_portal!integrantes_portal_profile_id_fkey(
            vinculado,
            cargo_nome,
            grau
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      console.log('useProfile fetch:', {
        userId,
        data,
        error,
        hasData: !!data
      });

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (data) {
        // Processar integrante (pode ser array)
        const integranteData = Array.isArray(data.integrante) 
          ? data.integrante[0] 
          : data.integrante;
        
        setProfile({
          ...data,
          integrante: integranteData || null
        } as Profile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    };

    fetchProfile();

    // Subscribe to profile changes
    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload);
          if (payload.eventType === 'DELETE') {
            setProfile(null);
          } else {
            // Processar integrante do payload também
            const newData = payload.new as any;
            const integranteData = Array.isArray(newData.integrante) 
              ? newData.integrante[0] 
              : newData.integrante;
            
            setProfile({
              ...newData,
              integrante: integranteData || null
            } as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { profile, loading };
};
