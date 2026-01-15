import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearchTerm } from "@/lib/utils";

export interface IntegrantePortal {
  id: string;
  registro_id: number;
  nome_colete: string;
  comando_texto: string;
  regional_texto: string;
  regional_id: string | null;
  divisao_texto: string;
  divisao_id: string | null;
  cargo_grau_texto: string;
  cargo_nome: string | null;
  grau: string | null;
  profile_id: string | null;
  vinculado: boolean;
  data_vinculacao: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  cargo_estagio: string | null;
  cargo_treinamento_id: string | null;
  sgt_armas: boolean;
  caveira: boolean;
  caveira_suplente: boolean;
  batedor: boolean;
  ursinho: boolean;
  lobo: boolean;
  tem_moto: boolean;
  tem_carro: boolean;
  data_entrada: string | null;
  combate_insano: boolean;
  // Dados de contato (vindos do profile vinculado)
  email?: string | null;
  telefone?: string | null;
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

  // Ref para debounce do realtime
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchIntegrantes();

    // Realtime subscription para detectar mudanças (com debounce)
    const channel = supabase
      .channel('integrantes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrantes_portal',
        },
        (payload) => {
          console.log('Integrante changed:', payload);
          
          // Debounce: aguardar 500ms após última mudança antes de recarregar
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            fetchIntegrantes();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [stableOptions]);

  const fetchIntegrantes = async () => {
    setLoading(true);
    
    let query = supabase
      .from('integrantes_portal')
      .select(`
        *,
        profiles:profile_id (
          email,
          telefone
        )
      `)
      .order('nome_colete');

    if (options?.vinculado !== undefined) {
      query = query.eq('vinculado', options.vinculado);
    }

    if (options?.ativo !== undefined) {
      query = query.eq('ativo', options.ativo);
    }

    if (options?.search) {
      const termoBusca = normalizeSearchTerm(options.search);
      query = query.ilike('nome_colete_ascii', `%${termoBusca}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching integrantes:', error);
    } else {
      // Mapear dados de contato do profile para campos de primeiro nível
      const integrantesComContato = (data || []).map((integrante: any) => ({
        ...integrante,
        email: integrante.profiles?.email || null,
        telefone: integrante.profiles?.telefone || null,
      }));
      
      setIntegrantes(integrantesComContato);
      
      // Calcular estatisticas
      const total = integrantesComContato.length;
      const vinculados = integrantesComContato.filter((i: any) => i.vinculado).length;
      const naoVinculados = integrantesComContato.filter((i: any) => !i.vinculado).length;
      const inativos = integrantesComContato.filter((i: any) => !i.ativo).length;
      
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
      
      const termoBusca = normalizeSearchTerm(nomeColete);
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('*')
        .ilike('nome_colete_ascii', `%${termoBusca}%`)
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

// Busca de integrantes SEM filtro de status (para entradas/saídas no relatório)
export const useBuscaIntegranteTodos = (nomeColete: string, filtrarPorDivisao?: string) => {
  const [resultados, setResultados] = useState<IntegrantePortal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nomeColete || nomeColete.length < 2) {
      setResultados([]);
      return;
    }

    const buscar = async () => {
      setLoading(true);
      
      const termoBusca = normalizeSearchTerm(nomeColete);
      let query = supabase
        .from('integrantes_portal')
        .select('*')
        .ilike('nome_colete_ascii', `%${termoBusca}%`)
        .order('nome_colete')
        .limit(15);

      // Filtrar por divisão se especificado
      if (filtrarPorDivisao) {
        query = query.eq('divisao_texto', filtrarPorDivisao);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching integrantes (todos):', error);
      } else {
        setResultados(data || []);
      }
      
      setLoading(false);
    };

    const timeoutId = setTimeout(buscar, 300);
    return () => clearTimeout(timeoutId);
  }, [nomeColete, filtrarPorDivisao]);

  return { resultados, loading };
};
