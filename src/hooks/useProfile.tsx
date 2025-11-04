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
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  comando_id: string | null;
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  grau: string | null;
  data_entrada: string | null;
  comando: string | null;
  integrante?: {
    vinculado: boolean;
    cargo_nome: string;
    grau: string;
    divisao_texto: string;
    tem_moto: boolean;
    tem_carro: boolean;
    sgt_armas: boolean;
    caveira: boolean;
    caveira_suplente: boolean;
    batedor: boolean;
    ursinho: boolean;
    lobo: boolean;
    combate_insano: boolean;
    cargo_estagio: string | null;
    ativo: boolean;
    data_entrada: string | null;
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
          comando:comandos(nome),
          integrante:integrantes_portal!integrantes_portal_profile_id_fkey(
            vinculado,
            cargo_nome,
            grau,
            divisao_texto,
            tem_moto,
            tem_carro,
            sgt_armas,
            caveira,
            caveira_suplente,
            batedor,
            ursinho,
            lobo,
            combate_insano,
            cargo_estagio,
            ativo,
            data_entrada
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
        
        // Processar comando (pode ser array ou objeto)
        const comandoData = Array.isArray(data.comando)
          ? data.comando[0]
          : data.comando;
        
        setProfile({
          ...data,
          comando: comandoData?.nome || null,
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
        async (payload) => {
          console.log('Profile updated via realtime:', payload);
          if (payload.eventType === 'DELETE') {
            setProfile(null);
          } else {
            // Fazer novo fetch completo para pegar dados do JOIN
            const { data, error } = await supabase
              .from('profiles')
              .select(`
                *,
                comando:comandos(nome),
                integrante:integrantes_portal!integrantes_portal_profile_id_fkey(
                  vinculado,
                  cargo_nome,
                  grau,
                  divisao_texto,
                  tem_moto,
                  tem_carro,
                  sgt_armas,
                  caveira,
                  caveira_suplente,
                  batedor,
                  ursinho,
                  lobo,
                  combate_insano,
                  cargo_estagio,
                  ativo,
                  data_entrada
                )
              `)
              .eq('id', userId)
              .maybeSingle();
            
            if (!error && data) {
              const integranteData = Array.isArray(data.integrante) 
                ? data.integrante[0] 
                : data.integrante;
              
              const comandoData = Array.isArray(data.comando)
                ? data.comando[0]
                : data.comando;
              
              setProfile({
                ...data,
                comando: comandoData?.nome || null,
                integrante: integranteData || null
              } as Profile);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to integrantes_portal changes
    const integranteChannel = supabase
      .channel(`integrante-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrantes_portal',
          filter: `profile_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Integrante updated via realtime:', payload);
          // Fazer novo fetch completo
          const { data, error } = await supabase
            .from('profiles')
            .select(`
              *,
              comando:comandos(nome),
              integrante:integrantes_portal!integrantes_portal_profile_id_fkey(
                vinculado,
                cargo_nome,
                grau,
                divisao_texto,
                tem_moto,
                tem_carro,
                sgt_armas,
                caveira,
                caveira_suplente,
                batedor,
                ursinho,
                lobo,
                combate_insano,
                cargo_estagio,
                ativo,
                data_entrada
              )
            `)
            .eq('id', userId)
            .maybeSingle();
          
          if (!error && data) {
            const integranteData = Array.isArray(data.integrante) 
              ? data.integrante[0] 
              : data.integrante;
            
            const comandoData = Array.isArray(data.comando)
              ? data.comando[0]
              : data.comando;
            
            setProfile({
              ...data,
              comando: comandoData?.nome || null,
              integrante: integranteData || null
            } as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(integranteChannel);
    };
  }, [userId]);

  return { profile, loading };
};
