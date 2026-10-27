// @ts-expect-error bun test runtime
import { describe, test, expect } from 'bun:test';
const { parseLinhas, indicadores, noPeriodo, mesDaData } = await import('../../supabase/functions/pesquisa-satisfacao-relatorio/calculo');

const linha = (over: Record<number, unknown> = {}) => {
  const r: unknown[] = [46322.58, 'c', 'Comando V', 'reg1', 'VP1', 'div1', 'DIVISAO X - SP', 5,
    'obj', 'mot', '', 'neg', 'pos', 'ideal', 'melhor', 'obs', 4, 3, 2, 'BATE_VOLTAS; INTEGRACAO_DIVISOES', '',
    0, 1, 0, 0, 0, 1, 0, 0];
  Object.entries(over).forEach(([k, v]) => { r[Number(k)] = v; });
  return r;
};

describe('relatório da pesquisa', () => {
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
