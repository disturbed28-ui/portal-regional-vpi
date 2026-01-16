import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { normalizarRegional, normalizarDivisao } from "@/lib/normalizeText";
import { getEscopoVisibilidade, temVisibilidadeTotal } from "@/lib/escopoVisibilidade";

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

    // Determinar escopo de visibilidade usando função centralizada
    const isAdmin = roles.includes('admin');
    const escopo = getEscopoVisibilidade(profile, roles, isAdmin);

    console.log('[useAcoesSociaisLista] Debug:', { 
      roles, 
      isAdmin,
      escopo,
      integranteRegionalTexto: profile?.integrante?.regional_texto,
      integranteDivisaoTexto: profile?.integrante?.divisao_texto
    });

    // REGRA: Comando (Grau I-IV, sem role admin) → Acesso total sem filtro
    if (temVisibilidadeTotal(escopo)) {
      console.log('[useAcoesSociaisLista] Acesso total (comando grau I-IV)');
      
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

    // REGRA: Admin e Grau V → Filtrar por REGIONAL
    if (escopo.nivelAcesso === 'regional' && escopo.filtroObrigatorio) {
      const regionalTexto = escopo.regionalTexto || profile?.integrante?.regional_texto;
      if (!regionalTexto) {
        console.error('[useAcoesSociaisLista] Nível regional sem regional_texto');
        return [];
      }
      regionalNormalizada = normalizarRegional(regionalTexto);
      console.log('[useAcoesSociaisLista] Filtrando por regional (admin ou grau V):', regionalNormalizada);
    }
    // REGRA: Grau VI+ → Filtrar por DIVISÃO
    else if (escopo.nivelAcesso === 'divisao' && escopo.filtroObrigatorio) {
      const divisaoTexto = escopo.divisaoTexto || profile?.integrante?.divisao_texto;
      if (!divisaoTexto) {
        console.error('[useAcoesSociaisLista] Grau VI+ sem divisao_texto');
        return [];
      }
      divisaoNormalizada = normalizarDivisao(divisaoTexto);
      console.log('[useAcoesSociaisLista] Filtrando por divisão:', divisaoNormalizada);
    }
    // Sem nível identificado com filtro obrigatório
    else if (escopo.filtroObrigatorio) {
      console.log('[useAcoesSociaisLista] Filtro obrigatório mas sem escopo definido');
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
