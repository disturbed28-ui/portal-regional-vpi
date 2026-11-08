import { INSTAGRAM_NA, validateInstagram } from './instagramPerfil.ts';

export function validarCadastroPerfil(dados: { nome_colete: string; telefone?: string; instagram?: string | null }) {
  const nome_colete = dados.nome_colete.trim();
  if (!nome_colete) throw new Error('Digite seu nome de colete.');
  if (!dados.telefone?.trim()) throw new Error('Digite seu telefone celular com DDD.');
  const telefone = dados.telefone.trim();
  if (telefone.length > 20) throw new Error('Telefone inválido.');
  const resultado = validateInstagram(dados.instagram?.trim() || INSTAGRAM_NA);
  if (!resultado.valid || !resultado.normalized) throw new Error(resultado.error || 'Instagram inválido.');
  return { nome_colete, telefone, instagram: resultado.normalized };
}

export function cadastroPerfilPendente(profile: { nome_colete?: string | null; telefone?: string | null; instagram?: string | null }) {
  return !profile.nome_colete?.trim() || !profile.telefone?.trim() || !profile.instagram?.trim();
}

export function statusAposCadastro(statusAtual: string) {
  return statusAtual === 'Ativo' || statusAtual === 'Inativo' ? statusAtual : 'Analise';
}