import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcularPeriodosCobraveis } from "./useCobrancaRelatorios";

/**
 * Hook leve: retorna apenas a contagem de divisões da regional sem
 * relatório fechado para o período mais recente em cobrança (dia 8/18/28).
 * Usado pelo modal de pendências e contadores — não busca telefones.
 */
export function useRelatoriosPendentesCount(regionalId: string | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const periodo = useMemo(() => calcularPeriodosCobraveis()[0] ?? null, []);

  useEffect(() => {
    if (!regionalId || !periodo) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data: divs } = await supabase
          .from("divisoes")
          .select("id")
          .eq("regional_id", regionalId);
        const divIds = (divs ?? []).map((d) => d.id);
        if (divIds.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }
        const { data: rels } = await supabase
          .from("relatorios_semanais_divisao")
          .select("divisao_relatorio_id")
          .in("divisao_relatorio_id", divIds)
          .eq("ano_referencia", periodo.anoReferencia)
          .eq("mes_referencia", periodo.mesReferencia)
          .eq("semana_no_mes", periodo.periodoNoMes);
        const entregues = new Set(
          (rels ?? []).map((r) => r.divisao_relatorio_id).filter(Boolean) as string[],
        );
        if (!cancelled) setCount(divIds.length - entregues.size);
      } catch (e) {
        console.error("[useRelatoriosPendentesCount]", e);
        if (!cancelled) setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [regionalId, periodo?.label]);

  return { count, loading, periodo };
}
