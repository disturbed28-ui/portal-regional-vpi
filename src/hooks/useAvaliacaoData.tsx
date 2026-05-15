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

export interface MensalidadesAvaliacaoInfo {
  pagasAtraso: number;
  abertas: number;
}

/**
 * Para cada registro_id, retorna:
 *  - pagasAtraso: mensalidades liquidadas (pagas com atraso) cuja liquidação ocorreu dentro do período
 *  - abertas: mensalidades ainda não liquidadas (ativo=true, liquidado=false) com vencimento até o fim do período
 */
export const useMensalidadesAtrasoPeriodo = (
  registroIds: number[],
  dataInicio: Date | null,
  dataFim: Date | null,
) => {
  const [map, setMap] = useState<Record<number, MensalidadesAvaliacaoInfo>>({});
  const key = registroIds.join(',') + '|' + (dataInicio?.toISOString() || '') + '|' + (dataFim?.toISOString() || '');
  useEffect(() => {
    if (registroIds.length === 0 || !dataInicio || !dataFim) { setMap({}); return; }
    (async () => {
      const fetchAll = async (apply: (q: any) => any) => {
        let all: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const base = supabase
            .from('mensalidades_atraso')
            .select('registro_id, data_vencimento, data_liquidacao, liquidado, ativo')
            .in('registro_id', registroIds)
            .range(from, from + pageSize - 1);
          const { data, error } = await apply(base);
          if (error) { console.error('[useMensalidadesAtrasoPeriodo]', error); break; }
          all = all.concat(data || []);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const inicioDate = dataInicio.toISOString().slice(0, 10);
      const fimDate = dataFim.toISOString().slice(0, 10);

      // Pagas em atraso: vencimento dentro do período E liquidação posterior ao vencimento
      // (independente de quando a liquidação foi importada)
      const [liquidadasNoPeriodo, abertas] = await Promise.all([
        fetchAll((q: any) => q
          .eq('liquidado', true)
          .gte('data_vencimento', inicioDate)
          .lte('data_vencimento', fimDate)),
        fetchAll((q: any) => q
          .eq('ativo', true)
          .eq('liquidado', false)
          .lte('data_vencimento', fimDate)),
      ]);

      const m: Record<number, MensalidadesAvaliacaoInfo> = {};
      const ensure = (id: number) => (m[id] = m[id] || { pagasAtraso: 0, abertas: 0 });
      for (const r of liquidadasNoPeriodo) {
        // Considerar paga em atraso somente se liquidação > vencimento
        if (!r.data_liquidacao || !r.data_vencimento) continue;
        const liq = new Date(r.data_liquidacao);
        const venc = new Date(r.data_vencimento + 'T23:59:59');
        if (liq > venc) ensure(r.registro_id).pagasAtraso += 1;
      }
      for (const r of abertas) ensure(r.registro_id).abertas += 1;
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
export interface DecisaoAvaliacao {
  id: string;
  periodo_id: string;
  integrante_id: string;
  etapa: 'divisao' | 'regional';
  decisao: 'aprovado' | 'reprovado';
  justificativa: string | null;
  nota_calculada: number;
  decidido_por: string;
  decidido_por_nome: string | null;
  decidido_em: string;
}

export interface DecisoesIntegrante {
  divisao?: DecisaoAvaliacao;
  regional?: DecisaoAvaliacao;
}

export const useDecisoesAvaliacao = (
  periodoId: string | null | undefined,
  integranteIds: string[],
) => {
  const [map, setMap] = useState<Record<string, DecisoesIntegrante>>({});
  const [loading, setLoading] = useState(false);
  const idsKey = integranteIds.join(',');

  const fetchData = useCallback(async () => {
    if (!periodoId || integranteIds.length === 0) { setMap({}); return; }
    setLoading(true);
    let all: DecisaoAvaliacao[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('avaliacoes_decisao_final' as any)
        .select('*')
        .eq('periodo_id', periodoId)
        .in('integrante_id', integranteIds)
        .range(from, from + pageSize - 1);
      if (error) { console.error('[useDecisoesAvaliacao]', error); break; }
      all = all.concat((data || []) as any);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    const m: Record<string, DecisoesIntegrante> = {};
    for (const d of all) {
      m[d.integrante_id] = m[d.integrante_id] || {};
      m[d.integrante_id][d.etapa] = d;
    }
    setMap(m);
    setLoading(false);
  }, [periodoId, idsKey]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  return { decisoesMap: map, loading, refetch: fetchData };
};

export const upsertDecisaoAvaliacao = async (input: {
  periodo_id: string;
  integrante_id: string;
  etapa: 'divisao' | 'regional';
  decisao: 'aprovado' | 'reprovado';
  justificativa: string | null;
  nota_calculada: number;
  decidido_por: string;
  decidido_por_nome: string | null;
}) => {
  const { error } = await supabase
    .from('avaliacoes_decisao_final' as any)
    .upsert(input, { onConflict: 'periodo_id,integrante_id,etapa' });
  if (error) {
    toast.error('Erro ao salvar decisão', { description: error.message, duration: 6000 });
    return false;
  }
  return true;
};

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
