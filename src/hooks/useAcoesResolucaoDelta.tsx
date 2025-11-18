import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AcaoResolucaoDelta {
  id: string;
  tipo_delta_codigo: string;
  codigo_acao: string;
  label: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const useAcoesResolucaoDelta = (tipoDeltaCodigo?: string) => {
  const { data: acoes, isLoading, refetch } = useQuery({
    queryKey: ['acoes-resolucao-delta', tipoDeltaCodigo],
    queryFn: async () => {
      let query = supabase
        .from('acoes_resolucao_delta')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (tipoDeltaCodigo) {
        query = query.eq('tipo_delta_codigo', tipoDeltaCodigo);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AcaoResolucaoDelta[];
    },
    enabled: !!tipoDeltaCodigo || tipoDeltaCodigo === undefined,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  const getAcoesPorTipo = (codigo: string): AcaoResolucaoDelta[] => {
    return acoes?.filter(a => a.tipo_delta_codigo === codigo) || [];
  };

  return {
    acoes: acoes || [],
    isLoading,
    refetch,
    getAcoesPorTipo,
  };
};
