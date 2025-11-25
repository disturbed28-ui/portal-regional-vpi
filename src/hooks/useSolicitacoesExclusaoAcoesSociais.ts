import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type StatusFiltro = 'pendente' | 'aprovado' | 'recusado' | 'todos';

export const useSolicitacoesExclusaoAcoesSociais = (statusFiltro: StatusFiltro = 'pendente') => {
  const { user } = useAuth();

  const fetchSolicitacoes = async () => {
    if (!user?.id) {
      console.log('[useSolicitacoesExclusao] Aguardando autenticação');
      return [];
    }

    let query = supabase
      .from('acoes_sociais_solicitacoes_exclusao')
      .select(`
        id,
        registro_id,
        profile_id,
        justificativa,
        status,
        created_at,
        updated_at,
        processado_por,
        processado_em,
        observacao_admin,
        registro:acoes_sociais_registros!acoes_sociais_solicitacoes_exclusao_registro_id_fkey (
          id,
          data_acao,
          escopo_acao,
          tipo_acao_nome_snapshot,
          descricao_acao,
          divisao_relatorio_texto,
          responsavel_nome_colete,
          status_registro
        )
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtro de status
    if (statusFiltro !== 'todos') {
      query = query.eq('status', statusFiltro);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useSolicitacoesExclusao] Erro ao buscar:', error);
      throw error;
    }

    console.log(`[useSolicitacoesExclusao] ${data?.length || 0} solicitações encontradas`);
    return data || [];
  };

  const { data: solicitacoes, isLoading, error, refetch } = useQuery({
    queryKey: ['acoes-sociais-solicitacoes-exclusao', statusFiltro],
    queryFn: fetchSolicitacoes,
    enabled: !!user?.id,
  });

  return {
    solicitacoes: solicitacoes || [],
    loading: isLoading,
    error,
    refetch,
  };
};
