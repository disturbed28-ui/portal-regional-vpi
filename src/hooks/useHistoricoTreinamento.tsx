import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { getNivelAcesso } from "@/lib/grauUtils";

export interface TreinamentoHistorico {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  cargo_treinamento_id: string;
  cargo_treinamento_nome: string;
  divisao_id: string;
  divisao_nome: string;
  regional_id: string;
  status: "Em Andamento" | "Concluído";
  tipo_encerramento?: string;
  data_inicio: string;
  data_encerramento?: string;
  solicitante_nome_colete: string;
  observacoes?: string;
}

export interface TreinamentosPorDivisao {
  divisao_id: string;
  divisao_nome: string;
  treinamentos: TreinamentoHistorico[];
}

interface UseHistoricoTreinamentoParams {
  userId?: string;
}

export const useHistoricoTreinamento = ({ userId }: UseHistoricoTreinamentoParams) => {
  const [treinamentos, setTreinamentos] = useState<TreinamentoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfile(userId);

  // Filtros locais
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "em_andamento" | "concluido">("todos");
  const [filtroDivisao, setFiltroDivisao] = useState<string>("todas");
  const [filtroNome, setFiltroNome] = useState("");

  useEffect(() => {
    if (!userId) return;
    
    const fetchHistorico = async () => {
      setLoading(true);
      setError(null);

      try {
        // Buscar perfil do usuário para determinar nível de acesso
        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("divisao_id, regional_id, grau")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) throw profileError;

        let nivelAcesso: "comando" | "regional" | "divisao" = "comando"; // Default: acesso total
        const userDivisaoId = userProfile?.divisao_id;
        const userRegionalId = userProfile?.regional_id;

        if (userProfile?.grau) {
          nivelAcesso = getNivelAcesso(userProfile.grau);
        }

        // 1. Buscar solicitações aprovadas (em andamento)
        let solicitacoesQuery = supabase
          .from("solicitacoes_treinamento")
          .select(`
            id,
            integrante_id,
            cargo_treinamento_id,
            divisao_id,
            regional_id,
            data_aprovacao,
            solicitante_nome_colete,
            integrantes_portal!solicitacoes_treinamento_integrante_id_fkey(nome_colete),
            cargos!solicitacoes_treinamento_cargo_treinamento_id_fkey(nome),
            divisoes!solicitacoes_treinamento_divisao_id_fkey(nome)
          `)
          .eq("status", "Aprovado");

        // Aplicar filtros de visibilidade
        if (nivelAcesso === "regional" && userRegionalId) {
          solicitacoesQuery = solicitacoesQuery.eq("regional_id", userRegionalId);
        } else if (nivelAcesso === "divisao" && userDivisaoId) {
          solicitacoesQuery = solicitacoesQuery.eq("divisao_id", userDivisaoId);
        }

        const { data: solicitacoes, error: solicitacoesError } = await solicitacoesQuery;
        if (solicitacoesError) throw solicitacoesError;

        // 2. Buscar histórico de treinamentos concluídos
        let historicoQuery = supabase
          .from("treinamentos_historico")
          .select(`
            id,
            integrante_id,
            cargo_treinamento_id,
            tipo_encerramento,
            observacoes,
            data_inicio,
            data_encerramento,
            solicitacao_id,
            integrantes_portal!treinamentos_historico_integrante_id_fkey(
              nome_colete,
              divisao_id,
              regional_id,
              divisoes!integrantes_portal_divisao_id_fkey(nome)
            ),
            cargos!treinamentos_historico_cargo_treinamento_id_fkey(nome),
            solicitacoes_treinamento!treinamentos_historico_solicitacao_id_fkey(
              solicitante_nome_colete,
              divisao_id,
              regional_id
            )
          `);

        const { data: historico, error: historicoError } = await historicoQuery;
        if (historicoError) throw historicoError;

        // Combinar resultados
        const treinamentosFormatados: TreinamentoHistorico[] = [];

        // Adicionar solicitações aprovadas (em andamento)
        solicitacoes?.forEach((sol) => {
          treinamentosFormatados.push({
            id: sol.id,
            integrante_id: sol.integrante_id,
            integrante_nome_colete: sol.integrantes_portal?.nome_colete || "N/A",
            cargo_treinamento_id: sol.cargo_treinamento_id,
            cargo_treinamento_nome: sol.cargos?.nome || "N/A",
            divisao_id: sol.divisao_id,
            divisao_nome: sol.divisoes?.nome || "N/A",
            regional_id: sol.regional_id,
            status: "Em Andamento",
            data_inicio: sol.data_aprovacao || "",
            solicitante_nome_colete: sol.solicitante_nome_colete,
          });
        });

        // Adicionar histórico concluído
        historico?.forEach((hist) => {
          // Aplicar filtros de visibilidade para histórico
          const divisaoId = hist.solicitacoes_treinamento?.divisao_id || hist.integrantes_portal?.divisao_id;
          const regionalId = hist.solicitacoes_treinamento?.regional_id || hist.integrantes_portal?.regional_id;

          if (nivelAcesso === "regional" && userRegionalId && regionalId !== userRegionalId) {
            return;
          }
          if (nivelAcesso === "divisao" && userDivisaoId && divisaoId !== userDivisaoId) {
            return;
          }

          treinamentosFormatados.push({
            id: hist.id,
            integrante_id: hist.integrante_id,
            integrante_nome_colete: hist.integrantes_portal?.nome_colete || "N/A",
            cargo_treinamento_id: hist.cargo_treinamento_id,
            cargo_treinamento_nome: hist.cargos?.nome || "N/A",
            divisao_id: divisaoId || "",
            divisao_nome: hist.integrantes_portal?.divisoes?.nome || "N/A",
            regional_id: regionalId || "",
            status: "Concluído",
            tipo_encerramento: hist.tipo_encerramento,
            data_inicio: hist.data_inicio || "",
            data_encerramento: hist.data_encerramento,
            solicitante_nome_colete: hist.solicitacoes_treinamento?.solicitante_nome_colete || "N/A",
            observacoes: hist.observacoes,
          });
        });

        setTreinamentos(treinamentosFormatados);
      } catch (err: any) {
        console.error("Erro ao buscar histórico de treinamentos:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorico();
  }, [userId]);

  // Aplicar filtros locais
  const treinamentosFiltrados = useMemo(() => {
    return treinamentos.filter((t) => {
      // Filtro de status
      if (filtroStatus === "em_andamento" && t.status !== "Em Andamento") return false;
      if (filtroStatus === "concluido" && t.status !== "Concluído") return false;

      // Filtro de divisão
      if (filtroDivisao !== "todas" && t.divisao_id !== filtroDivisao) return false;

      // Filtro de nome
      if (filtroNome && !t.integrante_nome_colete.toLowerCase().includes(filtroNome.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [treinamentos, filtroStatus, filtroDivisao, filtroNome]);

  // Agrupar por divisão
  const treinamentosPorDivisao = useMemo(() => {
    const grupos: Record<string, TreinamentosPorDivisao> = {};

    treinamentosFiltrados.forEach((t) => {
      if (!grupos[t.divisao_id]) {
        grupos[t.divisao_id] = {
          divisao_id: t.divisao_id,
          divisao_nome: t.divisao_nome,
          treinamentos: [],
        };
      }
      grupos[t.divisao_id].treinamentos.push(t);
    });

    // Ordenar divisões por nome
    return Object.values(grupos).sort((a, b) => a.divisao_nome.localeCompare(b.divisao_nome));
  }, [treinamentosFiltrados]);

  // Lista de divisões únicas para o filtro
  const divisoesDisponiveis = useMemo(() => {
    const divisoes = new Map<string, string>();
    treinamentos.forEach((t) => {
      if (!divisoes.has(t.divisao_id)) {
        divisoes.set(t.divisao_id, t.divisao_nome);
      }
    });
    return Array.from(divisoes.entries()).map(([id, nome]) => ({ id, nome }));
  }, [treinamentos]);

  return {
    treinamentosPorDivisao,
    divisoesDisponiveis,
    loading,
    error,
    filtroStatus,
    setFiltroStatus,
    filtroDivisao,
    setFiltroDivisao,
    filtroNome,
    setFiltroNome,
    totalRegistros: treinamentosFiltrados.length,
  };
};
