import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrantePortal {
  id: string;
  registro_id: number;
  nome_colete: string;
  comando_texto: string;
  regional_texto: string;
  divisao_texto: string;
  cargo_grau_texto: string;
  cargo_nome: string | null;
  grau: string | null;
  firebase_uid: string | null;
  profile_id: string | null;
  vinculado: boolean;
  data_vinculacao: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  cargo_estagio: string | null;
  sgt_armas: boolean;
  caveira: boolean;
  caveira_suplente: boolean;
  batedor: boolean;
  ursinho: boolean;
  lobo: boolean;
  tem_moto: boolean;
  tem_carro: boolean;
  data_entrada: string | null;
}

interface UseIntegrantesOptions {
  vinculado?: boolean;
  ativo?: boolean;
  search?: string;
}

export const useIntegrantes = (options?: UseIntegrantesOptions) => {
  const [integrantes, setIntegrantes] = useState<IntegrantePortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    vinculados: 0,
    naoVinculados: 0,
    inativos: 0,
  });

  // Estabilizar o objeto options para evitar loop infinito
  const stableOptions = useMemo(
    () => options,
    [options?.vinculado, options?.ativo, options?.search]
  );

  useEffect(() => {
    fetchIntegrantes();
  }, [stableOptions]);

  const fetchIntegrantes = async () => {
    setLoading(true);
    
    let query = supabase
      .from('integrantes_portal')
      .select('*')
      .order('nome_colete');

    if (options?.vinculado !== undefined) {
      query = query.eq('vinculado', options.vinculado);
    }

    if (options?.ativo !== undefined) {
      query = query.eq('ativo', options.ativo);
    }

    if (options?.search) {
      query = query.ilike('nome_colete', `%${options.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching integrantes:', error);
    } else {
      setIntegrantes(data || []);
      
      // Calcular estatisticas
      const total = data?.length || 0;
      const vinculados = data?.filter(i => i.vinculado).length || 0;
      const naoVinculados = data?.filter(i => !i.vinculado).length || 0;
      const inativos = data?.filter(i => !i.ativo).length || 0;
      
      setStats({ total, vinculados, naoVinculados, inativos });
    }
    
    setLoading(false);
  };

  return { integrantes, loading, stats, refetch: fetchIntegrantes };
};

export const useBuscaIntegrante = (nomeColete: string) => {
  const [resultados, setResultados] = useState<IntegrantePortal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nomeColete || nomeColete.length < 2) {
      setResultados([]);
      return;
    }

    const buscar = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('*')
        .ilike('nome_colete', `%${nomeColete}%`)
        .eq('ativo', true)
        .order('nome_colete')
        .limit(10);

      if (error) {
        console.error('Error searching integrantes:', error);
      } else {
        setResultados(data || []);
      }
      
      setLoading(false);
    };

    const timeoutId = setTimeout(buscar, 300);
    return () => clearTimeout(timeoutId);
  }, [nomeColete]);

  return { resultados, loading };
};
