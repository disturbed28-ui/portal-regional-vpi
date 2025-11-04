import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TipoEvento {
  tipo: string;
  cor: string;
}

export const useTiposEvento = () => {
  const { data: tiposEvento, isLoading } = useQuery({
    queryKey: ['tipos-evento-cores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_evento_peso')
        .select('tipo, cor')
        .eq('ativo', true);
      
      if (error) throw error;
      return data as TipoEvento[];
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  const getColorForType = (tipo: string): string => {
    const tipoEvento = tiposEvento?.find(t => t.tipo.toLowerCase() === tipo.toLowerCase());
    return tipoEvento?.cor || '#6b7280'; // Cinza padrão
  };

  return {
    tiposEvento: tiposEvento || [],
    isLoading,
    getColorForType,
  };
};
