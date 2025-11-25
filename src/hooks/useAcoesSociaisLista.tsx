import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";

export const useAcoesSociaisLista = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { roles } = useUserRole(user?.id);

  const fetchAcoes = async () => {
    if (!user?.id || !profile) {
      console.log('[useAcoesSociaisLista] Aguardando autenticação e profile');
      return [];
    }

    // Determinar filtro baseado em roles
    const isRegional = roles.includes('regional') || roles.includes('diretor_regional');
    const isDiretor = roles.includes('diretor_divisao');
    const isModerator = roles.includes('moderator');

    console.log('[useAcoesSociaisLista] Debug:', { 
      roles, 
      isRegional, 
      isDiretor, 
      isModerator,
      profileRegionalId: profile.regional_id,
      profileDivisaoId: profile.divisao_id 
    });

    let query = supabase
      .from('acoes_sociais_registros')
      .select(`
        *,
        solicitacao_exclusao:acoes_sociais_solicitacoes_exclusao(
          id,
          status,
          observacao_admin,
          created_at
        )
      `)
      .neq('status_registro', 'excluido')
      .order('data_acao', { ascending: false });

    if (isRegional && profile.regional_id) {
      // Buscar nome da regional usando o ID
      const { data: regionalData, error: regionalError } = await supabase
        .from('regionais')
        .select('nome')
        .eq('id', profile.regional_id)
        .single();

      if (regionalError) {
        console.error('[useAcoesSociaisLista] Erro ao buscar regional:', regionalError);
        return [];
      }

      if (regionalData?.nome) {
        console.log('[useAcoesSociaisLista] Filtrando por regional:', regionalData.nome);
        query = query.ilike('regional_relatorio_texto', `%${regionalData.nome}%`);
      } else {
        console.log('[useAcoesSociaisLista] Nome da regional não encontrado');
        return [];
      }
    } else if ((isDiretor || isModerator) && profile.divisao_id) {
      // Buscar nome da divisão usando o ID
      const { data: divisaoData, error: divisaoError } = await supabase
        .from('divisoes')
        .select('nome')
        .eq('id', profile.divisao_id)
        .single();

      if (divisaoError) {
        console.error('[useAcoesSociaisLista] Erro ao buscar divisão:', divisaoError);
        return [];
      }

      if (divisaoData?.nome) {
        console.log('[useAcoesSociaisLista] Filtrando por divisão:', divisaoData.nome);
        query = query.ilike('divisao_relatorio_texto', `%${divisaoData.nome}%`);
      } else {
        console.log('[useAcoesSociaisLista] Nome da divisão não encontrado');
        return [];
      }
    } else {
      // Sem permissão ou sem IDs necessários
      console.log('[useAcoesSociaisLista] Usuário sem permissão ou IDs ausentes');
      return [];
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useAcoesSociaisLista] Erro ao buscar ações:', error);
      throw error;
    }

    console.log(`[useAcoesSociaisLista] ${data?.length || 0} ações encontradas`);
    return data || [];
  };

  const { data: registros, isLoading, error, refetch } = useQuery({
    queryKey: ['acoes-sociais-lista', user?.id, profile?.id, roles],
    queryFn: fetchAcoes,
    enabled: !!user?.id && !!profile,
  });

  return { 
    registros: registros || [], 
    loading: isLoading, 
    error, 
    refetch 
  };
};
