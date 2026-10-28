// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';

import { ordenarPorVencimento } from './ordenaEstagiosEncerramento';

type Item = {
  nome: string;
  data_termino_previsto: string | null;
  data_inicio_estagio: string | null;
};

const item = (
  nome: string,
  termino: string | null,
  inicio: string | null = '2026-01-01T00:00:00.000Z'
): Item => ({ nome, data_termino_previsto: termino, data_inicio_estagio: inicio });

describe('ordenarPorVencimento (encerramento de estágio)', () => {
  it('coloca primeiro quem vence mais cedo', () => {
    const lista = [
      item('Fabião', '2026-12-30T00:00:00.000Z'),
      item('Luanzão', '2026-11-02T00:00:00.000Z'),
      item('Vada', '2026-10-29T00:00:00.000Z'),
    ];

    expect(ordenarPorVencimento(lista).map(e => e.nome)).toEqual(['Vada', 'Luanzão', 'Fabião']);
  });

  it('mantém a lista original intacta', () => {
    const lista = [item('B', '2026-12-30T00:00:00.000Z'), item('A', '2026-10-29T00:00:00.000Z')];
    ordenarPorVencimento(lista);
    expect(lista.map(e => e.nome)).toEqual(['B', 'A']);
  });

  it('joga para o fim quem não tem término previsto, do início mais antigo para o mais novo', () => {
    const lista = [
      item('Aprovado novo', null, '2026-10-01T00:00:00.000Z'),
      item('Com término', '2026-12-30T00:00:00.000Z'),
      item('Aprovado antigo', null, '2026-03-01T00:00:00.000Z'),
    ];

    expect(ordenarPorVencimento(lista).map(e => e.nome)).toEqual([
      'Com término',
      'Aprovado antigo',
      'Aprovado novo',
    ]);
  });

  it('não embaralha quando a lista já está na ordem de vencimento', () => {
    const lista = [
      item('Vence hoje', '2026-10-28T00:00:00.000Z'),
      item('Vence amanhã', '2026-10-29T00:00:00.000Z'),
    ];

    expect(ordenarPorVencimento(lista).map(e => e.nome)).toEqual(['Vence hoje', 'Vence amanhã']);
  });
});
