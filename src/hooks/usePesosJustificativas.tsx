import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JustificativaPeso {
  id: string;
  tipo: string;
  descricao: string | null;
  peso: number;
  ativo: boolean;
  cor: string;
  icone: string | null;
  ordem: number;
  bloqueado: boolean;
  created_at: string;
  updated_at: string;
}

export const usePesosJustificativas = () => {
  const queryClient = useQueryClient();

  const { data: justificativas, isLoading } = useQuery({
    queryKey: ['justificativas-peso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justificativas_peso')
        .select('*')
        .order('ordem');
      
      if (error) throw error;
      return data as JustificativaPeso[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<JustificativaPeso> }) => {
      const { data, error } = await supabase
        .from('justificativas_peso')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justificativas-peso'] });
      toast.success('Justificativa atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar justificativa');
      console.error(error);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (justificativa: Omit<JustificativaPeso, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('justificativas_peso')
        .insert(justificativa)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justificativas-peso'] });
      toast.success('Justificativa criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar justificativa');
      console.error(error);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      const updates = items.map(item => 
        supabase
          .from('justificativas_peso')
          .update({ ordem: item.ordem })
          .eq('id', item.id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justificativas-peso'] });
      toast.success('Ordem atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao reordenar');
      console.error(error);
    },
  });

  return {
    justificativas: justificativas || [],
    isLoading,
    update: updateMutation.mutate,
    create: createMutation.mutate,
    reorder: reorderMutation.mutate,
  };
};
