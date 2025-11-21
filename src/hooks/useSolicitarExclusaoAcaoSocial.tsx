import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SolicitarExclusaoParams {
  registro_id: string;
  justificativa: string;
}

export const useSolicitarExclusaoAcaoSocial = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registro_id, justificativa }: SolicitarExclusaoParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('acoes_sociais_solicitacoes_exclusao')
        .insert({
          registro_id,
          profile_id: user.id,
          justificativa,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) {
        console.error('[useSolicitarExclusao] Erro:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada!",
        description: "Um administrador irá analisar sua solicitação de exclusão.",
      });
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['acoes-sociais-lista'] });
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      
      // Mensagens mais amigáveis para erros comuns
      if (error.message?.includes('duplicate key')) {
        errorMessage = 'Já existe uma solicitação de exclusão pendente para esta ação.';
      } else if (error.message?.includes('violates row-level security')) {
        errorMessage = 'Você não tem permissão para solicitar a exclusão desta ação.';
      }

      toast({
        title: "Erro ao solicitar exclusão",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};
