import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizarDivisao, normalizarRegional } from '@/lib/normalizeText';
import { deduplicarHistorico, filtrarEscopoHistorico, lerPaginasHistorico, retornoRegistradoHistorico, type MovimentoHistorico } from '@/lib/historicoMovimentacoes';
import { mapearTipoMovimentacao } from './useMovimentacoesDeltas';

export async function lerHistoricoMovimentacoes(db: typeof supabase, escopo: { divisao?: string; regional?: string }) {
  const [cargas, integrantes, auditoria, deltas, afastados, estrutura] = await Promise.all([
    lerPaginasHistorico((a, b) => db.from('atualizacoes_carga').select('id,integrante_id,registro_id,nome_colete,campo_alterado,valor_anterior,valor_novo,created_at').in('campo_alterado', ['divisao_texto', 'regional_texto', 'ativo']).order('created_at').order('id').range(a, b)),
    lerPaginasHistorico((a, b) => db.from('integrantes_portal').select('id,registro_id,nome_colete,divisao_texto,regional_texto,divisao_id,regional_id,created_at').order('id').range(a, b)),
    lerPaginasHistorico((a, b) => db.from('integrantes_historico').select('id,integrante_id,acao,dados_anteriores,dados_novos,observacao,created_at').order('created_at').order('id').range(a, b)),
    lerPaginasHistorico((a, b) => db.from('vw_deltas_resolvidos').select('*').order('resolvido_em').order('id').range(a, b)),
    lerPaginasHistorico((a, b) => db.from('integrantes_afastados').select('id,registro_id,nome_colete,divisao_texto,divisao_id,data_afastamento,data_retorno_efetivo,motivo_baixa,observacoes_baixa').order('id').range(a, b)),
    lerPaginasHistorico((a, b) => db.from('divisoes').select('id,nome,regional:regionais(nome)').order('id').range(a, b)),
  ]);
  const pessoas = new Map(integrantes.map(i => [i.id, i]));
  const movimentos: MovimentoHistorico[] = [];
  // Reconstruct the event location by reversing changes later than that event.
  const localNaData = (id: string | null, data: string) => {
    const pessoa = id ? pessoas.get(id) : undefined;
    let divisao = pessoa?.divisao_texto || '';
    let regional = pessoa?.regional_texto || '';
    const mudancas = [
      ...cargas.filter(c => c.integrante_id === id && ['divisao_texto', 'regional_texto'].includes(c.campo_alterado)).map(c => ({ data: c.created_at, campo: c.campo_alterado, anterior: c.valor_anterior })),
      ...auditoria.filter(h => h.integrante_id === id).flatMap(h => {
        const antes = (h.dados_anteriores || {}) as Record<string, unknown>;
        const depois = (h.dados_novos || {}) as Record<string, unknown>;
        return ['divisao_texto', 'regional_texto'].filter(c => typeof antes[c] === 'string' && typeof depois[c] === 'string' && antes[c] !== depois[c]).map(c => ({ data: h.created_at, campo: c, anterior: String(antes[c]) }));
      }),
    ].filter(c => Date.parse(c.data) > Date.parse(data)).sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
    for (const c of mudancas) {
      if (c.campo === 'divisao_texto') divisao = c.anterior || '';
      else regional = c.anterior || '';
    }
    return { divisao, regional };
  };
  const adicionarAlteracao = (id: string, pessoaId: string | null, registro: number, nome: string, campo: string, antes: unknown, depois: unknown, data: string, detalhes?: string | null) => {
    const local = localNaData(pessoaId, data);
    const base = { id, registro_id: registro, nome_colete: nome, data_movimentacao: data, origem: 'carga' as const, divisao_atual: local.divisao, regional_origem: local.regional, detalhes };
    if (campo === 'ativo') {
      if (!['true', 'false'].includes(String(antes)) || !['true', 'false'].includes(String(depois)) || String(antes) === String(depois)) return;
      movimentos.push({ ...base, tipo_movimentacao: String(depois) === 'true' ? 'REATIVACAO' : 'INATIVACAO', valor_anterior: String(antes) === 'true' ? 'Ativo' : 'Inativo', valor_novo: String(depois) === 'true' ? 'Ativo' : 'Inativo' });
    } else {
      const normalizar = campo === 'divisao_texto' ? normalizarDivisao : normalizarRegional;
      if (typeof antes !== 'string' || typeof depois !== 'string' || normalizar(antes) === normalizar(depois)) return;
      movimentos.push({ ...base, tipo_movimentacao: campo === 'divisao_texto' ? 'MUDANCA_DIVISAO' : 'MUDANCA_REGIONAL', valor_anterior: antes, valor_novo: depois, ...(campo === 'divisao_texto' ? { divisao_origem: antes, divisao_destino: depois } : { regional_origem: antes, regional_destino: depois }) });
    }
  };
  for (const c of cargas) adicionarAlteracao(`carga_${c.id}`, c.integrante_id, c.registro_id, c.nome_colete, c.campo_alterado, c.valor_anterior, c.valor_novo, c.created_at);
  for (const h of auditoria) {
    const pessoa = h.integrante_id ? pessoas.get(h.integrante_id) : undefined;
    const antes = (h.dados_anteriores || {}) as Record<string, unknown>;
    const depois = (h.dados_novos || {}) as Record<string, unknown>;
    for (const campo of ['divisao_texto', 'regional_texto', 'ativo']) {
      adicionarAlteracao(`audit_${h.id}_${campo}`, h.integrante_id, pessoa?.registro_id || Number(antes.registro_id || depois.registro_id || 0), pessoa?.nome_colete || String(antes.nome_colete || depois.nome_colete || ''), campo, antes[campo], depois[campo], h.created_at, h.observacao);
    }
  }
  for (const i of integrantes) {
    const local = localNaData(i.id, i.created_at);
    movimentos.push({ id: `novo_${i.id}`, registro_id: i.registro_id, nome_colete: i.nome_colete, tipo_movimentacao: 'ENTRADA_NOVO', data_movimentacao: i.created_at, divisao_atual: local.divisao, regional_destino: local.regional, detalhes: 'Novo integrante cadastrado no portal', origem: 'delta' });
  }
  for (const d of deltas) {
    if (!d.tipo_delta || !d.resolvido_em) continue;
    const dados = (d.dados_adicionais || {}) as Record<string, unknown>;
    const tipo = mapearTipoMovimentacao(d.tipo_delta, typeof dados.acao_resolucao === 'string' ? dados.acao_resolucao : null, d.observacao_admin);
    if (tipo === 'OUTRO') continue;
    movimentos.push({ id: `delta_${d.id}`, registro_id: d.registro_id || 0, nome_colete: d.nome_colete || '', tipo_movimentacao: tipo, data_movimentacao: d.resolvido_em, divisao_atual: d.divisao_texto, detalhes: d.observacao_admin, origem: 'delta' });
  }
  for (const a of afastados) {
    const base = { registro_id: a.registro_id, nome_colete: a.nome_colete, divisao_atual: a.divisao_texto, divisao_origem_id: a.divisao_id, origem: 'delta' as const };
    if (a.data_afastamento) movimentos.push({ ...base, id: `afastamento_${a.id}`, tipo_movimentacao: 'SAIDA_AFASTAMENTO', data_movimentacao: a.data_afastamento, detalhes: 'Entrou em afastamento' });
    if (retornoRegistradoHistorico(a.motivo_baixa, a.data_retorno_efetivo) && a.data_retorno_efetivo) movimentos.push({ ...base, id: `retorno_${a.id}`, tipo_movimentacao: 'ENTRADA_RETORNO_AFASTAMENTO', data_movimentacao: a.data_retorno_efetivo, detalhes: 'Retorno efetivo de afastamento' });
    else if (a.data_retorno_efetivo && ['desligamento', 'expulso', 'expulsao'].includes(a.motivo_baixa || '')) movimentos.push({ ...base, id: `saida_afastado_${a.id}`, tipo_movimentacao: 'AFASTAMENTO_SAIDA', data_movimentacao: a.data_retorno_efetivo, detalhes: a.observacoes_baixa || a.motivo_baixa });
  }
  return deduplicarHistorico(filtrarEscopoHistorico(movimentos, escopo, estrutura.map(d => ({ id: d.id, nome: d.nome, regional: d.regional?.nome || '' }))));
}

export function useHistoricoMovimentacoesCompleto(escopo: { divisao?: string; regional?: string }) {
  return useQuery({ queryKey: ['historico-movimentacoes-completo', escopo.divisao, escopo.regional], queryFn: () => lerHistoricoMovimentacoes(supabase, escopo) });
}