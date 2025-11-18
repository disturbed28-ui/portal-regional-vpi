import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TipoDeltaConfig {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  bloqueado: boolean;
  created_at: string;
  updated_at: string;
}

export const useTiposDelta = () => {
  const { data: tiposDelta, isLoading, refetch } = useQuery({
    queryKey: ['tipos-delta-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_delta_config')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as TipoDeltaConfig[];
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  const getTipoByCode = (codigo: string): TipoDeltaConfig | undefined => {
    return tiposDelta?.find(t => t.codigo === codigo);
  };

  return {
    tiposDelta: tiposDelta || [],
    isLoading,
    refetch,
    getTipoByCode,
  };
};
