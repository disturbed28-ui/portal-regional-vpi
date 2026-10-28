// @ts-expect-error bun test runtime
import { describe, test, expect } from 'bun:test';
const { parseLinhas, indicadores, noPeriodo, mesDaData, participacao, contarEfetivo } = await import('../../supabase/functions/pesquisa-satisfacao-relatorio/calculo');

const linha = (over: Record<number, unknown> = {}) => {
  const r: unknown[] = [46322.58, 'c', 'Comando V', 'reg1', 'VP1', 'div1', 'DIVISAO X - SP', 5,
    'obj', 'mot', '', 'neg', 'pos', 'ideal', 'melhor', 'obs', 4, 3, 2, 'BATE_VOLTAS; INTEGRACAO_DIVISOES', '',
    0, 1, 0, 0, 0, 1, 0, 0];
  Object.entries(over).forEach(([k, v]) => { r[Number(k)] = v; });
  return r;
};

describe('relatório da pesquisa', () => {
  test('59 responses out of 163 active members remain below the target', () => {
    expect(participacao(59, 163)).toEqual({ integrantesAtivos: 163, percentual: 36.2, metaAtingida: false });
  });
  test('10 responses out of 24 division members remain below the target', () => {
    expect(participacao(10, 24)).toEqual({ integrantesAtivos: 24, percentual: 41.7, metaAtingida: false });
  });
  test('exactly 80 percent reaches the target', () => {
    expect(participacao(128, 160).metaAtingida).toBe(true);
    expect(participacao(127, 160).metaAtingida).toBe(false);
  });
  test('155 out of 160 exceeds the target', () => {
    expect(participacao(155, 160)).toEqual({ integrantesAtivos: 160, percentual: 96.9, metaAtingida: true });
  });
  test('rounded percentage cannot turn a below-target ratio into success', () => {
    expect(participacao(7999, 10000)).toMatchObject({ percentual: 80, metaAtingida: false });
  });
  test('zero members produces no percentage, and anonymous responses are not capped', () => {
    expect(participacao(1, 0)).toMatchObject({ percentual: null, metaAtingida: false });
    expect(participacao(25, 24).percentual).toBe(104.2);
  });
  test('regional effective count includes direct regional members but excludes inactive and other scopes', () => {
    const membros = [
      { ativo: true, regional_id: 'reg1', divisao_id: 'div1' },
      { ativo: true, regional_id: 'reg1', divisao_id: 'div2' },
      { ativo: true, regional_id: 'reg1', divisao_id: null },
      { ativo: false, regional_id: 'reg1', divisao_id: 'div1' },
      { ativo: true, regional_id: 'reg2', divisao_id: 'div3' },
    ];
    expect(contarEfetivo(membros, 'reg1', null).total).toBe(3);
    expect(contarEfetivo(membros, 'reg1', 'div1').total).toBe(1);
    expect(contarEfetivo(membros, 'reg1', null).porDivisao.get('div1')).toBe(1);
  });
  test('serial date maps to São Paulo month', () => {
    expect(mesDaData(46322.58)).toBe('2026-10');
  });
  test('old rows without new scores are not counted as zero', () => {
    const rs = parseLinhas([linha(), linha({ 16: '', 17: '', 18: '' }).slice(0, 16)]);
    const ind = indicadores(rs);
    expect(ind.medias.find(m => m.chave === 'satisfacao')).toMatchObject({ media: 5, avaliacoes: 2 });
    expect(ind.medias.find(m => m.chave === 'pertencimento')).toMatchObject({ media: 4, avaliacoes: 1 });
  });
  test('averages use one decimal', () => {
    const ind = indicadores(parseLinhas([linha({ 7: 5 }), linha({ 7: 4 }), linha({ 7: 4 })]));
    expect(ind.medias[0].media).toBe(4.3);
  });
  test('activity counted once per answer; percent over those who answered', () => {
    const ind = indicadores(parseLinhas([linha({ 19: 'BATE_VOLTAS; BATE_VOLTAS' }), linha({ 19: 'NENHUMA' })]));
    expect(ind.atividades.find(a => a.codigo === 'BATE_VOLTAS')).toMatchObject({ quantidade: 1, percentual: 50 });
    expect(ind.programacaoAdequada).toEqual({ quantidade: 1, percentual: 50 });
    expect(ind.respondentesAtividades).toBe(2);
  });
  test('rows without activity answer are excluded from the denominator', () => {
    const ind = indicadores(parseLinhas([linha(), linha({ 19: '' }).slice(0, 19)]));
    expect(ind.respondentesAtividades).toBe(1);
    expect(ind.atividades.find(a => a.codigo === 'BATE_VOLTAS')!.percentual).toBe(100);
  });
  test('period filter is by whole months, inclusive', () => {
    const [r] = parseLinhas([linha()]);
    expect(noPeriodo(r, '2026-10', '2026-10')).toBe(true);
    expect(noPeriodo(r, '2026-11', '2026-12')).toBe(false);
  });
});
