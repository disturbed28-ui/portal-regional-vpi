import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  calcularMetaCrescimento,
  normalizarNomeDivisao,
  type MetaCrescimentoResultado,
} from '@/lib/metaCrescimento';

interface UseMetaCrescimentoResult {
  meta: MetaCrescimentoResultado | null;
  loading: boolean;
  periodosLancados: number[];
  mesEncerrado: boolean;
  refetch: () => void;
}

/**
 * Calcula o atingimento da meta de 4% de crescimento da regional no mês,
 * acumulando as entradas/saídas dos períodos já lançados (1..N).
 * Se `periodoLimite` for informado, considera apenas os períodos <= limite.
 */
export const useMetaCrescimento = (
  regionalId?: string,
  ano?: number,
  mes?: number,
  periodoLimite?: number
): UseMetaCrescimentoResult => {
  const [meta, setMeta] = useState<MetaCrescimentoResultado | null>(null);
  const [periodosLancados, setPeriodosLancados] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!regionalId || !ano || !mes) {
      setMeta(null);
      return;
    }

    let cancelado = false;

    const carregar = async () => {
      setLoading(true);
      try {
        // 1. Divisões da regional (para filtrar o snapshot do mês anterior)
        const { data: divisoes } = await supabase
          .from('divisoes')
          .select('nome, nome_ascii')
          .eq('regional_id', regionalId);

        const nomesRegional = new Set(
          (divisoes || []).map((d: any) => normalizarNomeDivisao(d.nome_ascii || d.nome))
        );

        // 2. Base = último snapshot de integrantes do mês anterior
        const mesAnterior = mes === 1 ? 12 : mes - 1;
        const anoAnterior = mes === 1 ? ano - 1 : ano;
        const inicioAnterior = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
        const inicioAtual = `${ano}-${String(mes).padStart(2, '0')}-01`;

        const { data: carga } = await supabase
          .from('cargas_historico')
          .select('dados_snapshot, data_carga')
          .eq('tipo_carga', 'integrantes')
          .gte('data_carga', inicioAnterior)
          .lt('data_carga', inicioAtual)
          .order('data_carga', { ascending: false })
          .limit(1)
          .maybeSingle();

        let base = 0;
        const snapshot = carga?.dados_snapshot as any;
        const divisoesSnapshot: any[] = snapshot?.divisoes || [];
        divisoesSnapshot.forEach((div: any) => {
          const nome = normalizarNomeDivisao(div.divisao || '');
          if (nomesRegional.size === 0 || nomesRegional.has(nome)) {
            base += div.total || 0;
          }
        });

        // 3. Entradas/saídas acumuladas dos períodos lançados do mês
        const { data: relatorios } = await supabase
          .from('relatorios_semanais_divisao')
          .select('semana_no_mes, entradas_json, saidas_json')
          .eq('regional_relatorio_id', regionalId)
          .eq('ano_referencia', ano)
          .eq('mes_referencia', mes);

        let entradas = 0;
        let saidas = 0;
        const periodos = new Set<number>();

        (relatorios || []).forEach((r: any) => {
          if (periodoLimite && r.semana_no_mes > periodoLimite) return;
          periodos.add(r.semana_no_mes);
          entradas += ((r.entradas_json as any[]) || []).length;
          saidas += ((r.saidas_json as any[]) || []).length;
        });

        if (cancelado) return;
        setPeriodosLancados(Array.from(periodos).sort());
        setMeta(calcularMetaCrescimento(base, entradas, saidas));
      } catch (e) {
        console.error('[useMetaCrescimento] Erro:', e);
        if (!cancelado) setMeta(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    carregar();
    return () => {
      cancelado = true;
    };
  }, [regionalId, ano, mes, periodoLimite, tick]);

  const hoje = new Date();
  const ultimoDia = ano && mes ? new Date(ano, mes, 0).getDate() : 31;
  const mesJaPassou =
    !!ano && !!mes && (hoje.getFullYear() > ano || (hoje.getFullYear() === ano && hoje.getMonth() + 1 > mes));
  const mesEncerrado =
    mesJaPassou ||
    (!!ano &&
      !!mes &&
      hoje.getFullYear() === ano &&
      hoje.getMonth() + 1 === mes &&
      hoje.getDate() >= ultimoDia &&
      periodosLancados.includes(3)) ||
    periodosLancados.includes(3);

  return { meta, loading, periodosLancados, mesEncerrado, refetch };
};
