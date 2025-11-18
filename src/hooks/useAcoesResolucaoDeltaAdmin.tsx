import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AcaoResolucaoDelta } from "./useAcoesResolucaoDelta";

export const useAcoesResolucaoDeltaAdmin = () => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (acao: Partial<AcaoResolucaoDelta> & { id: string }) => {
      const { error } = await supabase
        .from('acoes_resolucao_delta')
        .update(acao)
        .eq('id', acao.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-resolucao-delta'] });
      toast.success('Ação atualizada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao atualizar ação:', error);
      toast.error('Erro ao atualizar ação');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (acao: Omit<AcaoResolucaoDelta, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('acoes_resolucao_delta')
        .insert(acao);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-resolucao-delta'] });
      toast.success('Ação criada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao criar ação:', error);
      toast.error('Erro ao criar ação');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('acoes_resolucao_delta')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-resolucao-delta'] });
      toast.success('Ação excluída com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao excluir ação:', error);
      toast.error('Erro ao excluir ação');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (acoes: Array<{ id: string; ordem: number }>) => {
      const updates = acoes.map(acao =>
        supabase
          .from('acoes_resolucao_delta')
          .update({ ordem: acao.ordem })
          .eq('id', acao.id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-resolucao-delta'] });
      toast.success('Ordem atualizada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao reordenar ações:', error);
      toast.error('Erro ao reordenar ações');
    },
  });

  return {
    update: updateMutation.mutateAsync,
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    reorder: reorderMutation.mutateAsync,
    isLoading: updateMutation.isPending || createMutation.isPending || deleteMutation.isPending || reorderMutation.isPending,
  };
};
