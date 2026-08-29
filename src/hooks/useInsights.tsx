import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDivisoes } from "@/hooks/useDivisoes";
import { getNivelAcesso } from "@/lib/grauUtils";
import { ordenarIntegrantes } from "@/lib/integranteOrdering";
import type { InsightStatus } from "@/lib/insightsCalculo";

export interface IntegranteInsight {
  id: string;
  nome_colete: string;
  grau: string | null;
  cargo_grau_texto: string | null;
  cargo_nome: string | null;
  divisao_id: string | null;
  data_entrada: string | null;
}

export interface ParticipacaoRegistro {
  id: string;
  insight_id: string;
  integrante_id: string;
  nome_colete_snapshot: string;
  grau_snapshot: string | null;
  cargo_grau_texto_snapshot: string | null;
  divisao_id_snapshot: string | null;
  status: InsightStatus;
  created_at: string;
  updated_at: string;
}

export interface InsightRegistro {
  id: string;
  numero_insight: number;
  data_insight: string;
  divisao_id: string;
  regional_id: string | null;
  responsavel_nome: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
  insight_participacoes: ParticipacaoRegistro[];
}

/** Escopo de divisões que o usuário autenticado pode lançar/consultar. */
export const useEscopoInsights = () => {
  const { user } = useAuth();
  const { profile, loading: loadingProfile } = useProfile(user?.id);

  const grau = profile?.integrante?.grau || profile?.grau || null;
  const nivelAcesso = getNivelAcesso(grau);
  const regionalId = profile?.regional_id || null;

  // Comando (Grau I-IV) enxerga todas as divisões; demais, apenas a sua regional
  const { divisoes, loading: loadingDivisoes } = useDivisoes(
    nivelAcesso === "comando" ? undefined : regionalId || undefined
  );

  const divisoesDisponiveis = useMemo(() => {
    if (nivelAcesso === "divisao" && profile?.divisao_id) {
      return divisoes.filter((d) => d.id === profile.divisao_id);
    }
    return divisoes;
  }, [divisoes, nivelAcesso, profile?.divisao_id]);

  const responsavelNome =
    profile?.nome_colete || profile?.name || user?.email || "Usuário";

  return {
    loading: loadingProfile || loadingDivisoes,
    nivelAcesso,
    regionalId,
    divisaoIdUsuario: profile?.divisao_id || null,
    divisoesDisponiveis,
    userId: user?.id || null,
    responsavelNome,
  };
};

/** Integrantes ATIVOS da divisão — todos os graus, sem exclusões. */
export const useIntegrantesDivisaoInsight = (divisaoId: string | null) => {
  return useQuery({
    queryKey: ["insights-integrantes-divisao", divisaoId],
    enabled: !!divisaoId,
    queryFn: async (): Promise<IntegranteInsight[]> => {
      const { data, error } = await supabase
        .from("integrantes_portal")
        .select("id, nome_colete, grau, cargo_grau_texto, cargo_nome, divisao_id, data_entrada")
        .eq("divisao_id", divisaoId!)
        .eq("ativo", true);

      if (error) throw error;
      return (data || []).sort(ordenarIntegrantes) as IntegranteInsight[];
    },
  });
};

/** Verifica lançamento duplicado: divisão + número + data. */
export const useInsightExistente = (
  divisaoId: string | null,
  numero: number | null,
  data: string | null
) => {
  return useQuery({
    queryKey: ["insight-existente", divisaoId, numero, data],
    enabled: !!divisaoId && !!numero && !!data,
    queryFn: async (): Promise<InsightRegistro | null> => {
      const { data: rows, error } = await supabase
        .from("insights")
        .select("*, insight_participacoes(*)")
        .eq("divisao_id", divisaoId!)
        .eq("numero_insight", numero!)
        .eq("data_insight", data!)
        .maybeSingle();

      if (error) throw error;
      return (rows as unknown as InsightRegistro) || null;
    },
  });
};

export interface FiltrosInsights {
  dataInicial?: string | null;
  dataFinal?: string | null;
  numeroInsight?: number | null;
  divisaoId?: string | null;
  divisoesEscopo: string[];
}

export const useInsightsLista = (filtros: FiltrosInsights, habilitado = true) => {
  return useQuery({
    queryKey: ["insights-lista", filtros],
    enabled: habilitado && filtros.divisoesEscopo.length > 0,
    queryFn: async (): Promise<InsightRegistro[]> => {
      let query = supabase
        .from("insights")
        .select("*, insight_participacoes(*)")
        .order("data_insight", { ascending: false })
        .order("numero_insight", { ascending: false });

      if (filtros.divisaoId) {
        query = query.eq("divisao_id", filtros.divisaoId);
      } else {
        query = query.in("divisao_id", filtros.divisoesEscopo);
      }
      if (filtros.dataInicial) query = query.gte("data_insight", filtros.dataInicial);
      if (filtros.dataFinal) query = query.lte("data_insight", filtros.dataFinal);
      if (filtros.numeroInsight) query = query.eq("numero_insight", filtros.numeroInsight);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as InsightRegistro[];
    },
  });
};

export interface SalvarInsightPayload {
  insightId?: string | null;
  numeroInsight: number;
  dataInsight: string;
  divisaoId: string;
  regionalId: string | null;
  responsavelNome: string;
  userId: string | null;
  participacoes: Array<{
    integrante_id: string;
    nome_colete_snapshot: string;
    grau_snapshot: string | null;
    cargo_grau_texto_snapshot: string | null;
    divisao_id_snapshot: string | null;
    status: InsightStatus;
  }>;
}

export const useSalvarInsight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SalvarInsightPayload) => {
      let insightId = payload.insightId;

      if (insightId) {
        const { error } = await supabase
          .from("insights")
          .update({
            responsavel_nome: payload.responsavelNome,
            atualizado_por: payload.userId,
          })
          .eq("id", insightId);
        if (error) throw error;

        const { error: delError } = await supabase
          .from("insight_participacoes")
          .delete()
          .eq("insight_id", insightId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase
          .from("insights")
          .insert({
            numero_insight: payload.numeroInsight,
            data_insight: payload.dataInsight,
            divisao_id: payload.divisaoId,
            regional_id: payload.regionalId,
            responsavel_nome: payload.responsavelNome,
            criado_por: payload.userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        insightId = data.id;
      }

      if (payload.participacoes.length > 0) {
        const { error } = await supabase.from("insight_participacoes").insert(
          payload.participacoes.map((p) => ({ ...p, insight_id: insightId! }))
        );
        if (error) throw error;
      }

      return insightId!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights-lista"] });
      queryClient.invalidateQueries({ queryKey: ["insight-existente"] });
    },
  });
};
