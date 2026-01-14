import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { getNivelAcesso } from "@/lib/grauUtils";

export interface EstagioHistorico {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  cargo_estagio_id: string;
  cargo_estagio_nome: string;
  grau_estagio: string;
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

export interface EstagiosPorDivisao {
  divisao_id: string;
  divisao_nome: string;
  estagios: EstagioHistorico[];
}

interface UseHistoricoEstagioParams {
  userId?: string;
}

export const useHistoricoEstagio = ({ userId }: UseHistoricoEstagioParams) => {
  const [estagios, setEstagios] = useState<EstagioHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfile(userId);

  // Filtros locais
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "em_andamento" | "concluido">("em_andamento");
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
          .from("solicitacoes_estagio")
          .select(`
            id,
            integrante_id,
            cargo_estagio_id,
            grau_estagio,
            divisao_id,
            regional_id,
            data_aprovacao,
            data_inicio_estagio,
            solicitante_nome_colete,
            integrantes_portal!solicitacoes_estagio_integrante_id_fkey(nome_colete),
            cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome),
            divisoes!solicitacoes_estagio_divisao_id_fkey(nome)
          `)
          .eq("status", "Em Estagio");

        // Aplicar filtros de visibilidade
        if (nivelAcesso === "regional" && userRegionalId) {
          solicitacoesQuery = solicitacoesQuery.eq("regional_id", userRegionalId);
        } else if (nivelAcesso === "divisao" && userDivisaoId) {
          solicitacoesQuery = solicitacoesQuery.eq("divisao_id", userDivisaoId);
        }

        const { data: solicitacoes, error: solicitacoesError } = await solicitacoesQuery;
        if (solicitacoesError) throw solicitacoesError;

        // 2. Buscar histórico de estágios concluídos
        const { data: historico, error: historicoError } = await supabase
          .from("estagios_historico")
          .select(`
            id,
            integrante_id,
            cargo_estagio_id,
            grau_estagio,
            tipo_encerramento,
            observacoes,
            data_inicio,
            data_encerramento,
            solicitacao_id,
            divisao_id,
            regional_id,
            integrantes_portal!estagios_historico_integrante_id_fkey(
              nome_colete,
              divisao_id,
              regional_id,
              divisoes!integrantes_portal_divisao_id_fkey(nome)
            ),
            cargos!estagios_historico_cargo_estagio_id_fkey(nome),
            solicitacoes_estagio!estagios_historico_solicitacao_id_fkey(
              solicitante_nome_colete,
              divisao_id,
              regional_id
            )
          `);

        if (historicoError) throw historicoError;

        // Combinar resultados
        const estagiosFormatados: EstagioHistorico[] = [];

        // Adicionar solicitações aprovadas (em andamento)
        solicitacoes?.forEach((sol) => {
          estagiosFormatados.push({
            id: sol.id,
            integrante_id: sol.integrante_id,
            integrante_nome_colete: (sol.integrantes_portal as any)?.nome_colete || "N/A",
            cargo_estagio_id: sol.cargo_estagio_id,
            cargo_estagio_nome: (sol.cargos as any)?.nome || "N/A",
            grau_estagio: sol.grau_estagio,
            divisao_id: sol.divisao_id || "",
            divisao_nome: (sol.divisoes as any)?.nome || "N/A",
            regional_id: sol.regional_id || "",
            status: "Em Andamento",
            data_inicio: sol.data_inicio_estagio || sol.data_aprovacao || "",
            solicitante_nome_colete: sol.solicitante_nome_colete,
          });
        });

        // Adicionar histórico concluído
        historico?.forEach((hist) => {
          // Aplicar filtros de visibilidade para histórico
          const divisaoId = hist.divisao_id || (hist.solicitacoes_estagio as any)?.divisao_id || (hist.integrantes_portal as any)?.divisao_id;
          const regionalId = hist.regional_id || (hist.solicitacoes_estagio as any)?.regional_id || (hist.integrantes_portal as any)?.regional_id;

          if (nivelAcesso === "regional" && userRegionalId && regionalId !== userRegionalId) {
            return;
          }
          if (nivelAcesso === "divisao" && userDivisaoId && divisaoId !== userDivisaoId) {
            return;
          }

          estagiosFormatados.push({
            id: hist.id,
            integrante_id: hist.integrante_id,
            integrante_nome_colete: (hist.integrantes_portal as any)?.nome_colete || "N/A",
            cargo_estagio_id: hist.cargo_estagio_id || "",
            cargo_estagio_nome: (hist.cargos as any)?.nome || "N/A",
            grau_estagio: hist.grau_estagio,
            divisao_id: divisaoId || "",
            divisao_nome: (hist.integrantes_portal as any)?.divisoes?.nome || "N/A",
            regional_id: regionalId || "",
            status: "Concluído",
            tipo_encerramento: hist.tipo_encerramento,
            data_inicio: hist.data_inicio || "",
            data_encerramento: hist.data_encerramento,
            solicitante_nome_colete: (hist.solicitacoes_estagio as any)?.solicitante_nome_colete || "N/A",
            observacoes: hist.observacoes,
          });
        });

        setEstagios(estagiosFormatados);
      } catch (err: any) {
        console.error("Erro ao buscar histórico de estágios:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorico();
  }, [userId]);

  // Aplicar filtros locais
  const estagiosFiltrados = useMemo(() => {
    return estagios.filter((e) => {
      // Filtro de status
      if (filtroStatus === "em_andamento" && e.status !== "Em Andamento") return false;
      if (filtroStatus === "concluido" && e.status !== "Concluído") return false;

      // Filtro de divisão
      if (filtroDivisao !== "todas" && e.divisao_id !== filtroDivisao) return false;

      // Filtro de nome
      if (filtroNome && !e.integrante_nome_colete.toLowerCase().includes(filtroNome.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [estagios, filtroStatus, filtroDivisao, filtroNome]);

  // Agrupar por divisão
  const estagiosPorDivisao = useMemo(() => {
    const grupos: Record<string, EstagiosPorDivisao> = {};

    estagiosFiltrados.forEach((e) => {
      if (!grupos[e.divisao_id]) {
        grupos[e.divisao_id] = {
          divisao_id: e.divisao_id,
          divisao_nome: e.divisao_nome,
          estagios: [],
        };
      }
      grupos[e.divisao_id].estagios.push(e);
    });

    // Ordenar divisões por nome
    return Object.values(grupos).sort((a, b) => a.divisao_nome.localeCompare(b.divisao_nome));
  }, [estagiosFiltrados]);

  // Lista de divisões únicas para o filtro
  const divisoesDisponiveis = useMemo(() => {
    const divisoes = new Map<string, string>();
    estagios.forEach((e) => {
      if (!divisoes.has(e.divisao_id)) {
        divisoes.set(e.divisao_id, e.divisao_nome);
      }
    });
    return Array.from(divisoes.entries()).map(([id, nome]) => ({ id, nome }));
  }, [estagios]);

  return {
    estagiosPorDivisao,
    divisoesDisponiveis,
    loading,
    error,
    filtroStatus,
    setFiltroStatus,
    filtroDivisao,
    setFiltroDivisao,
    filtroNome,
    setFiltroNome,
    totalRegistros: estagiosFiltrados.length,
  };
};
