import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TipoDeltaConfig } from "./useTiposDelta";

export const useTiposDeltaAdmin = () => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (tipo: Partial<TipoDeltaConfig> & { id: string }) => {
      const { error } = await supabase
        .from('tipos_delta_config')
        .update(tipo)
        .eq('id', tipo.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-delta-config'] });
      toast.success('Tipo de delta atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao atualizar tipo de delta:', error);
      toast.error('Erro ao atualizar tipo de delta');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tipo: Omit<TipoDeltaConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('tipos_delta_config')
        .insert(tipo);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-delta-config'] });
      toast.success('Tipo de delta criado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao criar tipo de delta:', error);
      toast.error('Erro ao criar tipo de delta');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tipos_delta_config')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-delta-config'] });
      toast.success('Tipo de delta excluído com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao excluir tipo de delta:', error);
      toast.error('Erro ao excluir tipo de delta');
    },
  });

  return {
    update: updateMutation.mutateAsync,
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isLoading: updateMutation.isPending || createMutation.isPending || deleteMutation.isPending,
  };
};
