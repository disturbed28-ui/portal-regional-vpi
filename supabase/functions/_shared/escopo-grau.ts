/**
 * Helper compartilhado para resolver escopo de carga por Grau do usuário.
 *
 * Regras:
 *  - Grau I-IV (comando/admin): sem restrição (atua nas regionais detectadas no arquivo)
 *  - Grau V (regional/adm_regional/diretor_regional): atua em TODA a regional do usuário
 *  - Grau VI+ (diretor_divisao/adm_divisao): atua APENAS na divisão do usuário
 */

export type EscopoCarga = 'comando' | 'regional' | 'divisao';

export interface EscopoInput {
  user_grau?: string | null;
  user_regional_id?: string | null;
  user_divisao_id?: string | null;
}

export interface EscopoResolvido {
  tipo: EscopoCarga;
  regional_id: string | null;
  divisao_id: string | null;
}

const ROMAN_TO_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

export function grauToNum(grau: string | null | undefined): number {
  if (!grau) return 999;
  return ROMAN_TO_NUM[grau.trim().toUpperCase()] || 999;
}

/**
 * Resolve o escopo da carga.
 * Lança erro se Grau V/VI sem o ID correspondente.
 */
export function resolverEscopo(input: EscopoInput): EscopoResolvido {
  const grauNum = grauToNum(input.user_grau);

  if (grauNum <= 4) {
    return { tipo: 'comando', regional_id: null, divisao_id: null };
  }

  if (grauNum === 5) {
    if (!input.user_regional_id) {
      throw new Error('Grau V sem regional_id definido — operação bloqueada por segurança.');
    }
    return { tipo: 'regional', regional_id: input.user_regional_id, divisao_id: null };
  }

  // Grau VI+
  if (!input.user_divisao_id) {
    throw new Error('Grau VI sem divisao_id definido — operação bloqueada por segurança.');
  }
  return { tipo: 'divisao', regional_id: input.user_regional_id ?? null, divisao_id: input.user_divisao_id };
}
