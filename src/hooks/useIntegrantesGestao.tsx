import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useRegionais, Regional } from "@/hooks/useRegionais";
import { useDivisoes, Divisao } from "@/hooks/useDivisoes";
import { getNivelAcesso, NivelAcesso } from "@/lib/grauUtils";
import { ordenarIntegrantes } from "@/lib/integranteOrdering";
import { normalizeSearchTerm } from "@/lib/utils";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

export interface EscopoUsuario {
  nivelAcesso: NivelAcesso;
  grau: string | null;
  regionalId: string | null;
  divisaoId: string | null;
}

export interface IntegrantesPorDivisao {
  divisaoId: string | null;
  divisaoNome: string;
  regionalNome: string;
  integrantes: IntegrantePortal[];
  totalAtivos: number;
}

interface UseIntegrantesGestaoReturn {
  // Escopo do usuário
  escopo: EscopoUsuario;
  
  // Dados agrupados
  integrantesPorDivisao: IntegrantesPorDivisao[];
  totalIntegrantes: number;
  
  // Filtros disponíveis
  regionaisDisponiveis: Regional[];
  divisoesDisponiveis: Divisao[];
  
  // Filtros selecionados
  filtroRegional: string;
  setFiltroRegional: (id: string) => void;
  filtroDivisao: string;
  setFiltroDivisao: (id: string) => void;
  filtroBusca: string;
  setFiltroBusca: (termo: string) => void;
  mostrarDesligados: boolean;
  setMostrarDesligados: (v: boolean) => void;

  // IDs de integrantes desligados com suspeita de erro (tinham afastamento retornado/vigente)
  suspeitasSet: Set<string>;
  
  // Estados
  loading: boolean;
  refetch: () => void;
}

export const useIntegrantesGestao = (userId: string | undefined): UseIntegrantesGestaoReturn => {
  const { profile, loading: profileLoading } = useProfile(userId);
  const { regionais: todasRegionais, loading: regionaisLoading } = useRegionais();
  
  // Determinar escopo do usuário
  const escopo = useMemo<EscopoUsuario>(() => {
    if (!profile) {
      return { nivelAcesso: 'divisao', grau: null, regionalId: null, divisaoId: null };
    }
    
    const grau = profile.grau || profile.integrante?.grau || null;
    const nivelAcesso = getNivelAcesso(grau);
    
    return {
      nivelAcesso,
      grau,
      regionalId: profile.regional_id,
      divisaoId: profile.divisao_id,
    };
  }, [profile]);
  
  // Regionais disponíveis baseadas no escopo
  const regionaisDisponiveis = useMemo(() => {
    if (escopo.nivelAcesso === 'comando') {
      return todasRegionais;
    }
    // Para Grau V e VI, regional já está travada
    return [];
  }, [escopo.nivelAcesso, todasRegionais]);
  
  // Estado dos filtros
  const [filtroRegional, setFiltroRegional] = useState<string>('');
  const [filtroDivisao, setFiltroDivisao] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [mostrarDesligados, setMostrarDesligados] = useState<boolean>(false);

  
  // Determinar regional efetiva para filtro de divisões
  const regionalEfetiva = useMemo(() => {
    if (escopo.nivelAcesso === 'comando') {
      return filtroRegional || '';
    }
    // Para Grau V e VI, usar regional do usuário
    return escopo.regionalId || '';
  }, [escopo.nivelAcesso, escopo.regionalId, filtroRegional]);
  
  // Buscar divisões da regional efetiva
  const { divisoes: todasDivisoes, loading: divisoesLoading } = useDivisoes(regionalEfetiva || undefined);
  
  // Divisões disponíveis baseadas no escopo
  const divisoesDisponiveis = useMemo(() => {
    if (escopo.nivelAcesso === 'divisao') {
      // Grau VI: divisão travada
      return [];
    }
    return todasDivisoes;
  }, [escopo.nivelAcesso, todasDivisoes]);
  
  // Limpar filtro de divisão quando regional mudar
  useEffect(() => {
    setFiltroDivisao('');
  }, [filtroRegional]);
  
  // Estado dos integrantes
  const [integrantes, setIntegrantes] = useState<IntegrantePortal[]>([]);
  const [suspeitasSet, setSuspeitasSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  const fetchIntegrantes = useCallback(async () => {
    if (profileLoading || !profile) {
      return;
    }
    
    setLoading(true);
    
    try {
      let query = supabase
        .from('integrantes_portal')
        .select(`
          *,
          profiles:profile_id (
            email,
            telefone
          )
        `)
        .eq('ativo', !mostrarDesligados);

      
      // Aplicar filtros de escopo
      if (escopo.nivelAcesso === 'divisao') {
        // Grau VI+: apenas sua divisão
        if (escopo.divisaoId) {
          query = query.eq('divisao_id', escopo.divisaoId);
        }
      } else if (escopo.nivelAcesso === 'regional') {
        // Grau V: apenas sua regional
        if (escopo.regionalId) {
          query = query.eq('regional_id', escopo.regionalId);
        }
        // Aplicar filtro de divisão se selecionado
        if (filtroDivisao) {
          query = query.eq('divisao_id', filtroDivisao);
        }
      } else {
        // Grau I-IV: aplicar filtros manuais
        if (filtroRegional) {
          query = query.eq('regional_id', filtroRegional);
        }
        if (filtroDivisao) {
          query = query.eq('divisao_id', filtroDivisao);
        }
      }
      
      // Aplicar busca por nome
      if (filtroBusca) {
        const termoBusca = normalizeSearchTerm(filtroBusca);
        query = query.ilike('nome_colete_ascii', `%${termoBusca}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching integrantes:', error);
        setIntegrantes([]);
        setSuspeitasSet(new Set());
      } else {
        // Mapear dados de contato do profile para campos de primeiro nível
        const integrantesComContato = (data || []).map((integrante: any) => ({
          ...integrante,
          email: integrante.profiles?.email || null,
          telefone: integrante.profiles?.telefone || null,
        }));
        setIntegrantes(integrantesComContato);

        // Detectar suspeitas de desligamento indevido:
        // integrante desligado que possui afastamento vigente OU já retornado.
        if (mostrarDesligados && integrantesComContato.length > 0) {
          const registroIds = integrantesComContato
            .map((i: any) => i.registro_id)
            .filter(Boolean);
          if (registroIds.length > 0) {
            const { data: afastados } = await supabase
              .from('integrantes_afastados')
              .select('registro_id, ativo, data_retorno_efetivo')
              .in('registro_id', registroIds);

            const registrosSuspeitos = new Set(
              (afastados || [])
                .filter((a: any) => a.ativo === true || a.data_retorno_efetivo !== null)
                .map((a: any) => a.registro_id)
            );

            setSuspeitasSet(
              new Set(
                integrantesComContato
                  .filter(
                    (i: any) =>
                      i.motivo_inativacao === 'desligado' &&
                      registrosSuspeitos.has(i.registro_id)
                  )
                  .map((i: any) => i.id)
              )
            );
          } else {
            setSuspeitasSet(new Set());
          }
        } else {
          setSuspeitasSet(new Set());
        }
      }
    } catch (err) {
      console.error('Error in fetchIntegrantes:', err);
      setIntegrantes([]);
      setSuspeitasSet(new Set());
    }
    
    setLoading(false);
  }, [profile, profileLoading, escopo, filtroRegional, filtroDivisao, filtroBusca, mostrarDesligados]);
  
  // Buscar integrantes quando filtros mudarem
  useEffect(() => {
    fetchIntegrantes();
  }, [fetchIntegrantes]);
  
  // Agrupar integrantes por divisão
  const integrantesPorDivisao = useMemo((): IntegrantesPorDivisao[] => {
    if (!integrantes.length) return [];
    
    // Agrupar por divisão
    const grupos: Record<string, IntegrantePortal[]> = {};
    
    integrantes.forEach((integrante) => {
      const key = integrante.divisao_id || 'sem-divisao';
      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(integrante);
    });
    
    // Converter para array e ordenar
    return Object.entries(grupos)
      .map(([divisaoId, lista]) => {
        const primeiro = lista[0];
        return {
          divisaoId: divisaoId === 'sem-divisao' ? null : divisaoId,
          divisaoNome: primeiro?.divisao_texto || 'Sem Divisão',
          regionalNome: primeiro?.regional_texto || 'Sem Regional',
          integrantes: [...lista].sort(ordenarIntegrantes),
          totalAtivos: lista.length,
        };
      })
      .sort((a, b) => a.divisaoNome.localeCompare(b.divisaoNome));
  }, [integrantes]);
  
  const totalIntegrantes = integrantes.length;
  
  return {
    escopo,
    integrantesPorDivisao,
    totalIntegrantes,
    regionaisDisponiveis,
    divisoesDisponiveis,
    filtroRegional,
    setFiltroRegional,
    filtroDivisao,
    setFiltroDivisao,
    filtroBusca,
    setFiltroBusca,
    mostrarDesligados,
    setMostrarDesligados,
    suspeitasSet,
    loading: loading || profileLoading || regionaisLoading || divisoesLoading,
    refetch: fetchIntegrantes,
  };
};
