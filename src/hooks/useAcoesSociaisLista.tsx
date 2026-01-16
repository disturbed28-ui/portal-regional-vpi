import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { normalizarRegional, normalizarDivisao } from "@/lib/normalizeText";
import { getNivelAcesso } from "@/lib/grauUtils";

interface FiltrosAcoesSociais {
  dataInicio?: Date;
  dataFim?: Date;
  divisaoId?: string;
}

export const useAcoesSociaisLista = (filtros?: FiltrosAcoesSociais) => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { roles } = useUserRole(user?.id);

  const fetchAcoes = async () => {
    if (!user?.id || !profile) {
      console.log('[useAcoesSociaisLista] Aguardando autenticação e profile');
      return [];
    }

    // Determinar nível de acesso baseado em role admin ou grau
    const isAdmin = roles.includes('admin');
    const grau = profile?.integrante?.grau || profile?.grau;
    const nivel = getNivelAcesso(grau);

    console.log('[useAcoesSociaisLista] Debug:', { 
      roles, 
      isAdmin,
      grau,
      nivel,
      integranteRegionalTexto: profile?.integrante?.regional_texto,
      integranteDivisaoTexto: profile?.integrante?.divisao_texto
    });

    // REGRA 1: Admin ou Graus I-IV (comando) → Acesso total
    if (isAdmin || nivel === 'comando') {
      console.log('[useAcoesSociaisLista] Acesso total (admin ou comando)');
      
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

      if (filtros?.dataInicio) {
        query = query.gte('data_acao', format(filtros.dataInicio, 'yyyy-MM-dd'));
      }
      if (filtros?.dataFim) {
        query = query.lte('data_acao', format(filtros.dataFim, 'yyyy-MM-dd'));
      }
      if (filtros?.divisaoId) {
        query = query.eq('divisao_relatorio_id', filtros.divisaoId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useAcoesSociaisLista] Erro ao buscar ações (acesso total):', error);
        throw error;
      }
      console.log(`[useAcoesSociaisLista] ${data?.length || 0} ações retornadas (acesso total)`);
      return data || [];
    }

    // Buscar dados de regional/divisão do usuário para normalização
    let regionalNormalizada: string | null = null;
    let divisaoNormalizada: string | null = null;

    // REGRA 2: Grau V (regional) → Filtrar pela regional
    if (nivel === 'regional') {
      const regionalTexto = profile?.integrante?.regional_texto;
      if (!regionalTexto) {
        console.error('[useAcoesSociaisLista] Grau V sem regional_texto');
        return [];
      }
      regionalNormalizada = normalizarRegional(regionalTexto);
      console.log('[useAcoesSociaisLista] Filtrando por regional:', regionalNormalizada);
    }
    // REGRA 3: Grau VI+ (divisão) → Filtrar pela divisão
    else if (nivel === 'divisao') {
      const divisaoTexto = profile?.integrante?.divisao_texto;
      if (!divisaoTexto) {
        console.error('[useAcoesSociaisLista] Grau VI+ sem divisao_texto');
        return [];
      }
      divisaoNormalizada = normalizarDivisao(divisaoTexto);
      console.log('[useAcoesSociaisLista] Filtrando por divisão:', divisaoNormalizada);
    }
    // Sem nível identificado
    else {
      console.log('[useAcoesSociaisLista] Nível de acesso não identificado, grau:', grau);
      return [];
    }

    // Buscar TODOS os registros (filtros de período são aplicados no banco)
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

    // Aplicar filtros de período (esses ficam no banco para performance)
    if (filtros?.dataInicio) {
      query = query.gte('data_acao', format(filtros.dataInicio, 'yyyy-MM-dd'));
    }
    if (filtros?.dataFim) {
      query = query.lte('data_acao', format(filtros.dataFim, 'yyyy-MM-dd'));
    }

    const { data: todosRegistros, error } = await query;

    if (error) {
      console.error('[useAcoesSociaisLista] Erro ao buscar ações:', error);
      throw error;
    }

    if (!todosRegistros || todosRegistros.length === 0) {
      console.log('[useAcoesSociaisLista] Nenhum registro encontrado');
      return [];
    }

    console.log(`[useAcoesSociaisLista] ${todosRegistros.length} registros antes da filtragem`);

    // Filtrar em JavaScript usando normalização
    let registrosFiltrados = todosRegistros;

    if (regionalNormalizada) {
      // Filtrar por regional usando normalização
      registrosFiltrados = todosRegistros.filter(registro => {
        const registroRegionalNorm = normalizarRegional(registro.regional_relatorio_texto || '');
        const match = registroRegionalNorm === regionalNormalizada;
        if (!match && registro.regional_relatorio_texto) {
          console.log('[useAcoesSociaisLista] Não match:', {
            original: registro.regional_relatorio_texto,
            normalizado: registroRegionalNorm,
            esperado: regionalNormalizada
          });
        }
        return match;
      });
    } else if (divisaoNormalizada) {
      // Filtrar por divisão usando normalização
      registrosFiltrados = todosRegistros.filter(registro => {
        const registroDivisaoNorm = normalizarDivisao(registro.divisao_relatorio_texto || '');
        const match = registroDivisaoNorm === divisaoNormalizada;
        if (!match && registro.divisao_relatorio_texto) {
          console.log('[useAcoesSociaisLista] Não match divisão:', {
            original: registro.divisao_relatorio_texto,
            normalizado: registroDivisaoNorm,
            esperado: divisaoNormalizada
          });
        }
        return match;
      });
    }

    // Filtro adicional por divisaoId específica (se fornecido nos filtros)
    if (filtros?.divisaoId) {
      registrosFiltrados = registrosFiltrados.filter(
        r => r.divisao_relatorio_id === filtros.divisaoId
      );
    }

    console.log(`[useAcoesSociaisLista] ${registrosFiltrados.length} ações após filtros de normalização`);
    return registrosFiltrados;
  };

  const { data: registros, isLoading, error, refetch } = useQuery({
    queryKey: [
      'acoes-sociais-lista', 
      user?.id, 
      profile?.id, 
      roles.sort().join(','),
      filtros?.dataInicio?.toISOString(),
      filtros?.dataFim?.toISOString(),
      filtros?.divisaoId
    ],
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
