import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProcessarSolicitacaoParams {
  solicitacaoId: string;
  registroId: string;
  novoStatus: 'aprovado' | 'recusado';
  observacaoAdmin?: string;
}

export const useProcessarSolicitacaoExclusaoAcaoSocial = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      solicitacaoId,
      registroId,
      novoStatus,
      observacaoAdmin,
    }: ProcessarSolicitacaoParams) => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const now = new Date().toISOString();

      // 1) Atualizar a solicitação
      const { error: solicitacaoError } = await supabase
        .from('acoes_sociais_solicitacoes_exclusao')
        .update({
          status: novoStatus,
          processado_por: user.id,
          processado_em: now,
          observacao_admin: observacaoAdmin || null,
        })
        .eq('id', solicitacaoId);

      if (solicitacaoError) {
        console.error('[useProcessarSolicitacao] Erro ao atualizar solicitação:', solicitacaoError);
        throw solicitacaoError;
      }

      // 2) Se aprovado, marcar registro como excluído
      if (novoStatus === 'aprovado') {
        const { error: registroError } = await supabase
          .from('acoes_sociais_registros')
          .update({
            status_registro: 'excluido',
          })
          .eq('id', registroId);

        if (registroError) {
          console.error('[useProcessarSolicitacao] Erro ao marcar registro como excluído:', registroError);
          throw registroError;
        }
      }

      return { novoStatus };
    },
    onSuccess: (data) => {
      const mensagem = data.novoStatus === 'aprovado'
        ? 'Solicitação aprovada e ação social excluída com sucesso!'
        : 'Solicitação recusada com sucesso!';

      toast({
        title: "Processamento concluído",
        description: mensagem,
      });

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['acoes-sociais-solicitacoes-exclusao'] });
      queryClient.invalidateQueries({ queryKey: ['acoes-sociais-lista'] });
    },
    onError: (error: any) => {
      let errorMessage = error.message || 'Erro desconhecido';

      if (error.message?.includes('violates row-level security')) {
        errorMessage = 'Você não tem permissão para processar esta solicitação.';
      }

      toast({
        title: "Erro ao processar solicitação",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};
