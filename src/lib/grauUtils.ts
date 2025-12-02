/**
 * Utilitários para trabalhar com graus romanos e determinar hierarquia
 */

const romanMap: Record<string, number> = {
  'I': 1,
  'II': 2,
  'III': 3,
  'IV': 4,
  'V': 5,
  'VI': 6,
  'VII': 7,
  'VIII': 8,
  'IX': 9,
  'X': 10,
  'XI': 11,
  'XII': 12
};

/**
 * Converte grau romano para número
 * @param grau - Grau romano (ex: "IV", "V", "VI")
 * @returns Número correspondente ou 999 se inválido
 */
export const romanToNumber = (grau: string | null | undefined): number => {
  if (!grau) return 999;
  const normalized = grau.trim().toUpperCase();
  return romanMap[normalized] || 999;
};

/**
 * Tipos de nível de acesso baseado no grau
 */
export type NivelAcesso = 'comando' | 'regional' | 'divisao';

/**
 * Determina o nível de acesso do usuário baseado no grau
 * @param grau - Grau romano do usuário
 * @returns Nível de acesso (comando, regional ou divisao)
 */
export const getNivelAcesso = (grau: string | null | undefined): NivelAcesso => {
  const grauNum = romanToNumber(grau);
  
  if (grauNum <= 4) {
    return 'comando';   // Grau I-IV: vê tudo
  }
  
  if (grauNum === 5) {
    return 'regional';  // Grau V: vê sua regional + divisões
  }
  
  return 'divisao';     // Grau VI+: vê apenas sua divisão
};

/**
 * Compara dois graus para ordenação
 * @returns Número negativo se a < b, positivo se a > b, 0 se iguais
 */
export const compareGraus = (grauA: string | null, grauB: string | null): number => {
  return romanToNumber(grauA) - romanToNumber(grauB);
};
