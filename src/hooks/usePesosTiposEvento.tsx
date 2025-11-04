import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TipoEventoPeso {
  id: string;
  tipo: string;
  descricao: string | null;
  peso: number;
  ativo: boolean;
  cor: string;
  icone: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export const usePesosTiposEvento = () => {
  const queryClient = useQueryClient();

  const { data: tiposEvento, isLoading } = useQuery({
    queryKey: ['tipos-evento-peso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_evento_peso')
        .select('*')
        .order('ordem');
      
      if (error) throw error;
      return data as TipoEventoPeso[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TipoEventoPeso> }) => {
      const { data, error } = await supabase
        .from('tipos_evento_peso')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-evento-peso'] });
      toast.success('Tipo de evento atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar tipo de evento');
      console.error(error);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tipoEvento: Omit<TipoEventoPeso, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tipos_evento_peso')
        .insert(tipoEvento)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-evento-peso'] });
      toast.success('Tipo de evento criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar tipo de evento');
      console.error(error);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      const updates = items.map(item => 
        supabase
          .from('tipos_evento_peso')
          .update({ ordem: item.ordem })
          .eq('id', item.id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-evento-peso'] });
      toast.success('Ordem atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao reordenar');
      console.error(error);
    },
  });

  return {
    tiposEvento: tiposEvento || [],
    isLoading,
    update: updateMutation.mutate,
    create: createMutation.mutate,
    reorder: reorderMutation.mutate,
  };
};
