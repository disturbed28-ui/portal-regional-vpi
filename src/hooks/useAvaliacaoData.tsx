import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export interface PeriodoAvaliacao {
  id: string;
  regional_id: string;
  nome: string;
  ano: number;
  semestre: number;
  status: 'aberto' | 'encerrado';
  data_inicio: string;
  data_fim: string;
  created_at: string;
  encerrado_em: string | null;
}

export interface CriterioAvaliacao {
  id: string;
  regional_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  peso: number;
  peso_manual: boolean;
}

export interface AvaliacaoIntegrante {
  id: string;
  periodo_id: string;
  integrante_id: string;
  criterio_id: string;
  status: 'sim' | 'nao';
  observacao: string | null;
  avaliador_id: string;
  avaliador_nome: string | null;
  updated_at: string;
}

const semestreAtual = () => (new Date().getMonth() < 6 ? 1 : 2);

export const usePeriodosAvaliacao = (regionalId: string | null | undefined) => {
  const [periodos, setPeriodos] = useState<PeriodoAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!regionalId) { setPeriodos([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('avaliacao_periodos')
      .select('*')
      .eq('regional_id', regionalId)
      .order('ano', { ascending: false })
      .order('semestre', { ascending: false });
    if (error) {
      console.error('[usePeriodosAvaliacao]', error);
      setPeriodos([]);
    } else {
      setPeriodos((data || []) as PeriodoAvaliacao[]);
    }
    setLoading(false);
  }, [regionalId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const periodoAtualAberto = useMemo(() => {
    const ano = new Date().getFullYear();
    const sem = semestreAtual();
    return periodos.find(p => p.ano === ano && p.semestre === sem && p.status === 'aberto') || null;
  }, [periodos]);

  return { periodos, loading, refetch: fetchData, periodoAtualAberto };
};

export const useCriteriosAvaliacao = (regionalId: string | null | undefined, somenteAtivos = false) => {
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!regionalId) { setCriterios([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('criterios_avaliacao').select('*').eq('regional_id', regionalId);
    if (somenteAtivos) q = q.eq('ativo', true);
    const { data, error } = await q.order('ativo', { ascending: false }).order('ordem').order('nome');
    if (error) { console.error('[useCriterios]', error); setCriterios([]); }
    else setCriterios((data || []) as CriterioAvaliacao[]);
    setLoading(false);
  }, [regionalId, somenteAtivos]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { criterios, loading, refetch: fetchData };
};

export const useAvaliacoesIntegrantes = (periodoId: string | null | undefined, integranteIds: string[]) => {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoIntegrante[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = integranteIds.join(',');

  const fetchData = useCallback(async () => {
    if (!periodoId || integranteIds.length === 0) { setAvaliacoes([]); return; }
    setLoading(true);
    // pagination if > 1000
    let all: AvaliacaoIntegrante[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('avaliacoes_integrantes')
        .select('*')
        .eq('periodo_id', periodoId)
        .in('integrante_id', integranteIds)
        .range(from, from + pageSize - 1);
      if (error) { console.error('[useAvaliacoes]', error); break; }
      all = all.concat((data || []) as AvaliacaoIntegrante[]);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    setAvaliacoes(all);
    setLoading(false);
  }, [periodoId, idsKey]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  return { avaliacoes, loading, refetch: fetchData };
};

export const upsertAvaliacao = async (input: {
  periodo_id: string;
  integrante_id: string;
  criterio_id: string;
  status: 'sim' | 'nao';
  observacao?: string | null;
  avaliador_id: string;
  avaliador_nome?: string | null;
}) => {
  const { error } = await supabase
    .from('avaliacoes_integrantes')
    .upsert(input, { onConflict: 'periodo_id,integrante_id,criterio_id' });
  if (error) {
    toast.error('Erro ao salvar avaliação', { description: error.message, duration: 6000 });
    return false;
  }
  return true;
};

/**
 * Conta mensalidades pagas com atraso (liquidadas) no período por registro_id.
 */
export const useMensalidadesAtrasoPeriodo = (
  registroIds: number[],
  dataInicio: Date | null,
  dataFim: Date | null,
) => {
  const [map, setMap] = useState<Record<number, number>>({});
  const key = registroIds.join(',') + '|' + (dataInicio?.toISOString() || '') + '|' + (dataFim?.toISOString() || '');
  useEffect(() => {
    if (registroIds.length === 0 || !dataInicio || !dataFim) { setMap({}); return; }
    (async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('mensalidades_atraso')
          .select('registro_id')
          .in('registro_id', registroIds)
          .eq('liquidado', true)
          .gte('data_liquidacao', dataInicio.toISOString())
          .lte('data_liquidacao', dataFim.toISOString())
          .range(from, from + pageSize - 1);
        if (error) { console.error('[useMensalidadesAtrasoPeriodo]', error); break; }
        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      const m: Record<number, number> = {};
      for (const r of all) m[r.registro_id] = (m[r.registro_id] || 0) + 1;
      setMap(m);
    })();
  }, [key]); // eslint-disable-line
  return map;
};

/**
 * Busca data REAL da última promoção por integrante.
 * Considera promoção apenas quando, no histórico de `atualizacoes_carga`,
 * existe um registro com `valor_novo` igual ao grau atual e `valor_anterior`
 * diferente e não vazio (mudança real, não artefato de carga).
 */
export const useUltimaPromocaoGrau = (
  grausPorRegistro: Record<number, string | null | undefined>
) => {
  const [map, setMap] = useState<Record<number, string>>({});
  const registroIds = Object.keys(grausPorRegistro).map(Number);
  const key = registroIds.join(',') + '|' + Object.values(grausPorRegistro).join(',');
  useEffect(() => {
    if (registroIds.length === 0) { setMap({}); return; }
    (async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('atualizacoes_carga')
          .select('registro_id, created_at, valor_anterior, valor_novo')
          .in('registro_id', registroIds)
          .eq('campo_alterado', 'grau')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) { console.error('[useUltimaPromocao]', error); break; }
        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      const m: Record<number, string> = {};
      const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase();
      for (const r of all) {
        if (m[r.registro_id]) continue;
        const grauAtual = norm(grausPorRegistro[r.registro_id]);
        const novo = norm(r.valor_novo);
        const anterior = norm(r.valor_anterior);
        if (!grauAtual) continue;
        // Só conta como promoção real: virou o grau atual a partir de outro grau não vazio
        if (novo === grauAtual && anterior && anterior !== grauAtual) {
          m[r.registro_id] = r.created_at;
        }
      }
      setMap(m);
    })();
  }, [key]); // eslint-disable-line
  return map;
};
