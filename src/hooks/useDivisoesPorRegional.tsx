import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Divisao {
  id: string;
  nome: string;
}

export const useDivisoesPorRegional = (regionalId: string | null | undefined) => {
  const { data: divisoes, isLoading } = useQuery({
    queryKey: ['divisoes-por-regional', regionalId],
    queryFn: async (): Promise<Divisao[]> => {
      if (!regionalId) return [];
      
      const { data, error } = await supabase
        .from('divisoes')
        .select('id, nome')
        .eq('regional_id', regionalId)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!regionalId
  });

  return { 
    divisoes: divisoes || [], 
    divisaoIds: divisoes?.map(d => d.id) || [],
    isLoading 
  };
};
