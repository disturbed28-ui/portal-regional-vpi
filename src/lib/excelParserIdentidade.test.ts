// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';
import { processDelta } from './excelParser';
import { mesmoRegistroIntegrante } from '../../supabase/functions/_shared/identidadeIntegrante';

const novo = { id_integrante: 202, nome_colete: 'Minero', comando: 'COMANDO V', regional: 'REGIONAL VP3 - SP', divisao: 'DIVISAO CENTRO - SP', cargo_grau: 'PP (Grau X)', data_entrada: '2020-01-01' };
const antigo = { id: 'antigo', registro_id: 101, nome_colete: 'Minero', regional_texto: novo.regional, divisao_texto: novo.divisao, cargo_grau_texto: 'Social Divisão (Grau VI)', data_entrada: novo.data_entrada, ativo: false };

describe('identificação exclusiva pelo ID nas cargas', () => {
  it('nome e data iguais com IDs diferentes não reativam o cadastro antigo', () => {
    const resultado = processDelta([novo], [antigo] as any);
    expect(resultado.reativados).toEqual([]);
    expect(resultado.atualizados).toEqual([]);
    expect(resultado.novos.map(item => item.id_integrante)).toEqual([202]);
  });
  it('três homônimos do comando continuam sendo três pessoas distintas', () => {
    const pessoas = [101, 303, 404].map(registro_id => ({ ...antigo, id: String(registro_id), registro_id }));
    const resultado = processDelta([novo], pessoas as any);
    expect(resultado.reativados).toEqual([]);
    expect(resultado.novos).toHaveLength(1);
    expect(pessoas.map(item => item.registro_id)).toEqual([101, 303, 404]);
  });
  it('o mesmo ID permite retorno mesmo com nome de colete diferente', () => {
    const resultado = processDelta([{ ...novo, id_integrante: 101, nome_colete: 'Novo nome' }], [antigo] as any);
    expect(resultado.reativados.map(item => item.antigo.registro_id)).toEqual([101]);
    expect(resultado.novos).toEqual([]);
  });
  it('um homônimo ativo com ID diferente não recebe atualização', () => {
    const resultado = processDelta([novo], [{ ...antigo, ativo: true }] as any);
    expect(resultado.atualizados).toEqual([]);
    expect(resultado.novos.map(item => item.id_integrante)).toEqual([202]);
  });
  it('a proteção de gravação rejeita IDs diferentes e IDs ausentes', () => {
    expect(mesmoRegistroIntegrante(101, 202)).toBe(false);
    expect(mesmoRegistroIntegrante(undefined, 202)).toBe(false);
    expect(mesmoRegistroIntegrante(101, 101)).toBe(true);
  });
});