// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';
import { calcularPeriodoAtual, calcularPeriodoAnterior } from './normalizeText';
import { incorporarMovimentosCMD, periodoMensalCMD } from './movimentacoesMensaisCMD';

describe('movimentações mensais do CMD', () => {
  it('os três períodos de outubro enxergam de 1 a 31, incluindo movimentos fora do período', () => {
    for (const dia of [5, 15, 28]) {
      const periodo = calcularPeriodoAtual(new Date(2026, 9, dia));
      const mes = periodoMensalCMD(periodo);
      expect(mes.dataInicio.toISOString()).toBe('2026-10-01T03:00:00.000Z');
      expect(mes.dataFim.toISOString()).toBe('2026-11-01T02:59:59.999Z');
      const movimentos = ['2026-09-30T12:00:00Z', '2026-10-02T12:00:00Z', '2026-10-15T12:00:00Z', '2026-10-28T12:00:00Z', '2026-11-01T12:00:00Z'];
      expect(movimentos.filter(data => new Date(data) >= mes.dataInicio && new Date(data) <= mes.dataFim)).toEqual(movimentos.slice(1, 4));
    }
  });
  it('na virada do mês não carrega os movimentos do mês anterior', () => {
    const mes = periodoMensalCMD(calcularPeriodoAtual(new Date(2026, 10, 5)));
    expect(mes.dataInicio.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(mes.dataFim.toISOString()).toBe('2026-12-01T02:59:59.999Z');
  });
  it('um relatório pendente do mês anterior usa seu próprio mês de referência', () => {
    const mes = periodoMensalCMD(calcularPeriodoAnterior(new Date(2027, 0, 5)));
    expect(mes.dataInicio.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(mes.dataFim.toISOString()).toBe('2027-01-01T02:59:59.999Z');
  });
  it('respeita fevereiro bissexto', () => {
    expect(periodoMensalCMD({ ano_referencia: 2028, mes_referencia: 2 }).dataFim.toISOString()).toBe('2028-03-01T02:59:59.999Z');
  });
  it('incorpora novos deltas sem duplicar nem apagar correções manuais', () => {
    const existentes = [{ integrante_id: '1', nome_colete: 'Minero', data_entrada: '2026-10-20', motivo: 'Editado', _chave_dedup: 'novo_1' }];
    const detectados = [{ ...existentes[0], motivo: 'Novo' }, { integrante_id: '2', nome_colete: 'Helom', data_entrada: '2026-10-24', motivo: 'Novo', _chave_dedup: 'novo_2' }];
    const resultado = incorporarMovimentosCMD(existentes, detectados);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].motivo).toBe('Editado');
    expect(incorporarMovimentosCMD(resultado, detectados)).toHaveLength(2);
  });
  it('a entrada preenchida não impede a incorporação independente de saída e retorno', () => {
    expect(incorporarMovimentosCMD([], [{ nome_colete: 'A', data_saida: '2026-10-02' }])).toHaveLength(1);
    expect(incorporarMovimentosCMD([{ integrante_id: '1', data_entrada: '2026-10-02' }], [{ integrante_id: '1', data_entrada: '2026-10-20' }])).toHaveLength(2);
  });
});