// @ts-expect-error bun test runtime
import { describe, expect, test } from 'bun:test';
import { validarCadastroPerfil, cadastroPerfilPendente, statusAposCadastro } from '../../supabase/functions/_shared/cadastroPerfil';

describe('cadastro único', () => {
  test('telefone é obrigatório', () => {
    expect(() => validarCadastroPerfil({ nome_colete: 'Gigante', telefone: ' ', instagram: '@gigante' })).toThrow('telefone');
  });
  test('Instagram vazio não impede cadastro e salva N/A', () => {
    expect(validarCadastroPerfil({ nome_colete: ' Gigante ', telefone: '(12) 99999-9999', instagram: '' }))
      .toEqual({ nome_colete: 'Gigante', telefone: '(12) 99999-9999', instagram: 'N/A' });
  });
  test('opção de não informar é aceita', () => {
    expect(validarCadastroPerfil({ nome_colete: 'Gigante', telefone: '12999999999', instagram: 'N/A' }).instagram).toBe('N/A');
  });
  test('Instagram fornecido é normalizado junto dos demais campos', () => {
    expect(validarCadastroPerfil({ nome_colete: 'Gigante', telefone: '12999999999', instagram: 'gigante.vp2' }).instagram).toBe('@gigante.vp2');
  });
  test('Instagram inválido não grava cadastro parcial', () => {
    expect(() => validarCadastroPerfil({ nome_colete: 'Gigante', telefone: '12999999999', instagram: 'nome com espaço' })).toThrow('letras');
  });
  test('cadastro concluído sem Instagram não gera nova pendência', () => {
    expect(cadastroPerfilPendente(validarCadastroPerfil({ nome_colete: 'Gigante', telefone: '12999999999' }))).toBe(false);
    expect(cadastroPerfilPendente({ nome_colete: 'Gigante', telefone: '', instagram: 'N/A' })).toBe(true);
  });
  test('cadastro mantém aprovação existente e encaminha pendente para análise', () => {
    expect(statusAposCadastro('Ativo')).toBe('Ativo');
    expect(statusAposCadastro('Inativo')).toBe('Inativo');
    expect(statusAposCadastro('Pendente')).toBe('Analise');
    expect(statusAposCadastro('Recusado')).toBe('Analise');
  });
});