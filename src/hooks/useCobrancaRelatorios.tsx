import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PeriodoRelatorio {
  /** Identificador legível: "01-10/04/2026". */
  label: string;
  /** Texto curto para usar em mensagens: "1 a 10 de abril de 2026". */
  textoMensagem: string;
  /** Início do período (YYYY-MM-DD). */
  inicio: string;
  /** Fim do período (YYYY-MM-DD). */
  fim: string;
  /** Data limite a partir da qual a cobrança é exibida (YYYY-MM-DD). */
  dataCobranca: string;
}

export interface DivisaoPendente {
  divisao_id: string;
  divisao_nome: string;
  diretor_nome: string | null;
  diretor_telefone: string | null;
  diretor_profile_id: string | null;
  diretor_cargo: string | null;
  ja_enviou: boolean;
}

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Calcula os 3 períodos relevantes (1-10, 11-20, 21-fim) e retorna
 * o último período cuja "data de cobrança" (dia 8/18/28) já passou.
 * Ex.: hoje = 19/abr → retorna período 11-20 do mês corrente? Não:
 *  - dia 8 cobra período 1 (mês anterior se ainda não fechou) — simplificação:
 *  - Considera os 3 últimos períodos fechados (cobertura simples).
 *
 * Aqui retornamos os períodos cuja data de cobrança (8, 18 ou 28) é <= hoje
 * e fim do período <= hoje, dos últimos 60 dias.
 */
export function calcularPeriodosCobraveis(hoje = new Date()): PeriodoRelatorio[] {
  const periodos: PeriodoRelatorio[] = [];

  // Gerar candidatos dos últimos 2 meses + mês corrente
  for (let offset = -2; offset <= 0; offset++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    const ano = ref.getFullYear();
    const mes = ref.getMonth(); // 0-based
    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

    const blocos = [
      { inicio: 1, fim: 10, cobra: 8 },
      { inicio: 11, fim: 20, cobra: 18 },
      { inicio: 21, fim: ultimoDiaMes, cobra: 28 },
    ];

    for (const b of blocos) {
      const dataCobranca = new Date(ano, mes, b.cobra);
      // Só considera períodos cuja data de cobrança já chegou
      if (dataCobranca > hoje) continue;
      // E cujo fim do período já passou (ou é hoje)
      // (no dia 8 cobramos o período 1-10? Sim — gestor pediu cobrança no dia 8,
      // pois ele pretende que fechem até essa data.)

      const inicioStr = `${ano}-${pad(mes + 1)}-${pad(b.inicio)}`;
      const fimStr = `${ano}-${pad(mes + 1)}-${pad(b.fim)}`;
      const dataCobStr = `${ano}-${pad(mes + 1)}-${pad(b.cobra)}`;

      periodos.push({
        label: `${pad(b.inicio)}-${pad(b.fim)}/${pad(mes + 1)}/${ano}`,
        textoMensagem: `${b.inicio} a ${b.fim} de ${MESES_PT[mes]} de ${ano}`,
        inicio: inicioStr,
        fim: fimStr,
        dataCobranca: dataCobStr,
      });
    }
  }

  // Ordena do mais recente para o mais antigo e devolve no máximo 3 últimos
  periodos.sort((a, b) => b.dataCobranca.localeCompare(a.dataCobranca));
  return periodos.slice(0, 3);
}

/**
 * Hook que retorna divisões da regional sem relatório fechado para um período
 * + dados do diretor (telefone para WhatsApp).
 */
export function useCobrancaRelatorios(
  regionalId: string | undefined,
  periodo: PeriodoRelatorio | null,
) {
  const [divisoes, setDivisoes] = useState<DivisaoPendente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refetch = () => setRefreshTick((t) => t + 1);

  useEffect(() => {
    if (!regionalId || !periodo) {
      setDivisoes([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Divisões da regional
        const { data: divs, error: errDivs } = await supabase
          .from("divisoes")
          .select("id, nome")
          .eq("regional_id", regionalId)
          .order("nome");
        if (errDivs) throw errDivs;
        const divList = divs ?? [];
        if (divList.length === 0) {
          if (!cancelled) setDivisoes([]);
          return;
        }
        const divIds = divList.map((d) => d.id);

        // 2. Relatórios já entregues no período para essas divisões
        const { data: rels, error: errRels } = await supabase
          .from("relatorios_semanais_divisao")
          .select("divisao_relatorio_id, semana_inicio, semana_fim")
          .in("divisao_relatorio_id", divIds)
          .gte("semana_inicio", periodo.inicio)
          .lte("semana_fim", periodo.fim);
        if (errRels) throw errRels;

        const divisoesEntregues = new Set(
          (rels ?? []).map((r) => r.divisao_relatorio_id).filter(Boolean) as string[],
        );

        // 3. Diretores das divisões pendentes (cargo Diretor de Divisão, não Sub)
        const divPendIds = divList
          .filter((d) => !divisoesEntregues.has(d.id))
          .map((d) => d.id);

        let diretoresMap = new Map<
          string,
          { nome: string; telefone: string | null; profile_id: string | null; cargo: string | null }
        >();

        if (divPendIds.length > 0) {
          const { data: diretores, error: errDir } = await supabase
            .from("integrantes_portal")
            .select("divisao_id, nome_colete, cargo_grau_texto, profile_id")
            .in("divisao_id", divPendIds)
            .eq("ativo", true)
            .ilike("cargo_grau_texto", "%Diretor%Divis%")
            .not("cargo_grau_texto", "ilike", "%Sub%");
          if (errDir) throw errDir;

          // Pega o primeiro diretor por divisão
          const profileIds: string[] = [];
          (diretores ?? []).forEach((d) => {
            if (!d.divisao_id) return;
            if (!diretoresMap.has(d.divisao_id)) {
              diretoresMap.set(d.divisao_id, {
                nome: d.nome_colete,
                telefone: null,
                profile_id: d.profile_id,
                cargo: d.cargo_grau_texto,
              });
              if (d.profile_id) profileIds.push(d.profile_id);
            }
          });

          // 4. Telefones dos diretores via profiles
          if (profileIds.length > 0) {
            const { data: profs, error: errProf } = await supabase
              .from("profiles")
              .select("id, telefone")
              .in("id", profileIds);
            if (errProf) throw errProf;
            const telMap = new Map((profs ?? []).map((p) => [p.id, p.telefone]));
            diretoresMap.forEach((info) => {
              if (info.profile_id) info.telefone = telMap.get(info.profile_id) ?? null;
            });
          }
        }

        // 5. Logs de envio já realizados para este template + período
        const { data: logs } = await supabase
          .from("notificacoes_whatsapp_log")
          .select("divisao_id, payload")
          .eq("template_chave", "relatorios_cobranca")
          .gte("created_at", `${periodo.dataCobranca}T00:00:00`);
        const enviados = new Set(
          (logs ?? [])
            .filter((l: any) => {
              const pPeriodo = l?.payload?.periodo_label;
              return !pPeriodo || pPeriodo === periodo.label;
            })
            .map((l: any) => l.divisao_id)
            .filter(Boolean),
        );

        const result: DivisaoPendente[] = divList
          .filter((d) => !divisoesEntregues.has(d.id))
          .map((d) => {
            const info = diretoresMap.get(d.id);
            return {
              divisao_id: d.id,
              divisao_nome: d.nome,
              diretor_nome: info?.nome ?? null,
              diretor_telefone: info?.telefone ?? null,
              diretor_profile_id: info?.profile_id ?? null,
              diretor_cargo: info?.cargo ?? null,
              ja_enviou: enviados.has(d.id),
            };
          });

        if (!cancelled) setDivisoes(result);
      } catch (e: any) {
        console.error("[useCobrancaRelatorios] erro:", e);
        if (!cancelled) setError(e.message ?? "Erro ao carregar pendências");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [regionalId, periodo?.label, refreshTick]);

  const totalPendentes = useMemo(() => divisoes.length, [divisoes]);
  return { divisoes, totalPendentes, loading, error, refetch };
}
