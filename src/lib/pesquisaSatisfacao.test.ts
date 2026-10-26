// @ts-expect-error bun test runtime
import { describe, test, expect, mock } from 'bun:test';
import * as zod from 'zod';
mock.module('npm:zod@3.25.76', () => zod);
const { respostaSchema, hierarquiaDasAbas, linhaDaResposta, PERGUNTAS } = await import('../../supabase/functions/pesquisa-satisfacao/model');
const c = '11111111-1111-4111-8111-111111111111';
const r = '22222222-2222-4222-8222-222222222222';
const d = '33333333-3333-4333-8333-333333333333';
const dados = { comandos: [{ id: c, nome: 'Comando V' }], regionais: [{ id: r, comandoId: c, nome: 'VP1', sigla: 'VP1' }], divisoes: [{ id: d, regionalId: r, nome: 'DIVISAO TESTE - SP' }], perguntas: PERGUNTAS };
const payload = { comandoId: c, regionalId: r, divisaoId: d, nota: 5, pertencimento: 4, lideranca: 3, atividades: 2, respostas: PERGUNTAS.map(() => 'Resposta') };
describe('Pesquisa pública', () => {
  test('nota admite somente inteiros de 1 a 5', () => {
    for (const nota of [1, 2, 3, 4, 5]) expect(respostaSchema.safeParse({ ...payload, nota }).success).toBe(true);
    for (const nota of [0, 6, 1.5, '5']) expect(respostaSchema.safeParse({ ...payload, nota }).success).toBe(false);
  });
  test('sete respostas, quinta e sétima opcionais, limite 5000', () => {
    const respostas = [...payload.respostas]; respostas[4] = ''; respostas[6] = '';
    expect(respostaSchema.safeParse({ ...payload, respostas }).success).toBe(true);
    respostas[0] = ' '; expect(respostaSchema.safeParse({ ...payload, respostas }).success).toBe(false);
    expect(respostaSchema.safeParse({ ...payload, respostas: ['a'] }).success).toBe(false);
    expect(respostaSchema.safeParse({ ...payload, respostas: payload.respostas.map(() => 'a'.repeat(5001)) }).success).toBe(false);
  });
  test('rejeita identidade de integrante no envio', () => {
    for (const key of ['nome', 'email', 'integranteId', 'userId']) expect(respostaSchema.safeParse({ ...payload, [key]: 'identidade' }).success).toBe(false);
    const linha = linhaDaResposta(payload, dados);
    expect(linha).toHaveLength(19); expect(linha[10]).toBe(''); expect(linha.slice(16)).toEqual([4, 3, 2]); expect(linha.slice(1, 8)).toEqual([c, 'Comando V', r, 'VP1', d, 'DIVISAO TESTE - SP', 5]);
  });
  test('as quatro notas são obrigatórias, de 1 a 5', () => {
    for (const k of ['pertencimento', 'lideranca', 'atividades']) { expect(respostaSchema.safeParse({ ...payload, [k]: 6 }).success).toBe(false); const { [k]: _, ...sem } = payload as any; expect(respostaSchema.safeParse(sem).success).toBe(false); }
  });
  test('divisão deve pertencer à regional e ao comando selecionados', () => {
    expect(() => linhaDaResposta({ ...payload, regionalId: d }, dados)).toThrow();
    expect(() => linhaDaResposta({ ...payload, comandoId: d }, dados)).toThrow();
  });
  test('preserva filtros de CMD e divisão regional fornecidos', () => {
    const result = hierarquiaDasAbas([{ values: [['id', 'nome'], [c, 'Comando V']] }, { values: [['h'], [r, c, '', 'VP1', 'VP1'], [d, c, '', 'CMD', 'CMD']] }, { values: [['h'], [d, r, '', '', '', 'DIVISAO TESTE - SP'], [c, r, '', '', '', 'DIVISAO REGIONAL VP1'], [r, r, '', '', '', 'REGIONAL VP1']] }]);
    expect(result.regionais.map(x => x.id)).toEqual([r]); expect(result.divisoes.map(x => x.id)).toEqual([d]);
  });
  test('texto não vira fórmula e data mantém célula numérica', () => {
    const linha = linhaDaResposta({ ...payload, respostas: ['=1+1', '+cmd', '-cmd', '@cmd', '', 'ok', 'ok'] }, dados, new Date('2026-10-26T23:17:00Z'));
    expect(typeof linha[0]).toBe('number'); expect(linha.slice(8, 13)).toEqual(["'=1+1", "'+cmd", '', "'-cmd", "'@cmd"]);
  });
});