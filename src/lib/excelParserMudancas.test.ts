// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';
import { listarMudancasIntegrante } from './excelParser';

const antigo = {
  nome_colete: 'Luanzão', comando_texto: 'COMANDO REGIONAL V', regional_texto: 'REGIONAL VALE DO PARAIBA I - SP',
  divisao_texto: 'DIVISAO SAO JOSE DOS CAMPOS SUL - SP', cargo_grau_texto: 'Social Divisão (Grau VI)', cargo_estagio: null,
  sgt_armas: false, caveira: false, caveira_suplente: false, batedor: false, ursinho: false, lobo: false,
  tem_moto: false, tem_carro: false, data_entrada: null,
};
const novo: any = {
  nome_colete: 'Luanzão', comando: 'Comando Regional V', regional: 'Regional Vale do Paraíba I - SP',
  divisao: 'Divisão São José dos Campos Sul - SP', cargo_grau: 'PP (Grau X)',
};

describe('listarMudancasIntegrante', () => {
  it('mostra o cargo de → para', () => {
    expect(listarMudancasIntegrante(antigo, novo)).toEqual([
      { label: 'Cargo / Grau', anterior: 'Social Divisão (Grau VI)', novo: 'PP (Grau X)' },
    ]);
  });
  it('acento e maiúsculas não contam como alteração', () => {
    expect(listarMudancasIntegrante(antigo, { ...novo, cargo_grau: 'SOCIAL DIVISAO (GRAU VI)' })).toEqual([]);
  });
});
