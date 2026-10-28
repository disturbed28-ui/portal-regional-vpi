// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';
import { lerMovimentacoesCMD } from '../../supabase/functions/_shared/movimentacoes-cmd';
import { unirMovimentosMensaisCMD } from '../../supabase/functions/_shared/resumo-movimentacoes-cmd';

describe('entradas mensais CMD Centro e Extremo Norte SJC', () => {
  const novos = [
    { id: 'minero', registro_id: 468630, nome_colete: 'Minero', divisao_texto: 'DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP', created_at: '2026-10-21T10:33:45.422Z' },
    { id: 'helom', registro_id: 469971, nome_colete: 'Helom', divisao_texto: 'DIVISAO SAO JOSE DOS CAMPOS EXTREMO NORTE - SP', created_at: '2026-10-26T11:34:52.297Z' },
  ];
  const db = { from(tabela: string) {
    const query: any = {};
    for (const metodo of ['select', 'eq', 'gte', 'lte', 'order', 'in', 'or']) query[metodo] = () => query;
    query.range = async () => ({ data: tabela === 'integrantes_portal' ? novos : [], error: null });
    return query;
  } };
  for (const [divisao, nome] of [['DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP', 'Minero'], ['DIVISAO SAO JOSE DOS CAMPOS EXTREMO NORTE - SP', 'Helom']]) {
    it(`detecta ${nome} mesmo sem relatório enviado pela divisão`, async () => {
      const movimentos = await lerMovimentacoesCMD(db, { divisao, dataInicio: new Date('2026-10-01T03:00:00Z'), dataFim: new Date('2026-11-01T02:59:59.999Z'), incluirAfastamentos: true });
      expect(movimentos.entradas.map(m => m.nome_colete)).toEqual([nome]);
    });
  }
  it('Helom preenchido à mão com outra data não duplica a entrada da carga', () => {
    const manual = { nome_colete: 'Helom', integrante_id: '', data_entrada: '2026-10-22', motivo_entrada: 'Novo', possui_moto: true };
    const detectado = { nome_colete: 'Helom', integrante_id: 'helom', data_entrada: '2026-10-26', motivo_entrada: 'Novo' };
    expect(unirMovimentosMensaisCMD([manual, manual], [detectado], 'data_entrada')).toEqual([manual]);
  });
  it('preserva dois retornos realmente diferentes no mesmo mês', () => {
    expect(unirMovimentosMensaisCMD([], [{ integrante_id: 'a', nome_colete: 'A', data_entrada: '2026-10-02', motivo_entrada: 'Retorno' }, { integrante_id: 'a', nome_colete: 'A', data_entrada: '2026-10-20', motivo_entrada: 'Retorno' }], 'data_entrada')).toHaveLength(2);
  });
});