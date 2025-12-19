/**
 * Funções centralizadas de normalização de texto para hierarquia (divisão/regional/comando)
 * Garante consistência em todo o sistema: importações, edições manuais e agrupamentos
 */

/**
 * Remove acentos e converte para maiúscula
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Normaliza divisão para formato padrão: DIVISAO [NOME] - SP
 * Trata também casos de Grau V onde divisão é uma regional
 */
export function normalizarDivisaoTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Se contém REGIONAL (caso Grau V), manter prefixo REGIONAL
  if (normalizado.includes('REGIONAL')) {
    normalizado = normalizado.replace(/^(DIVISAO\s+)?REGIONAL\s*/i, 'REGIONAL ');
  } else {
    // Garantir prefixo DIVISAO
    if (!normalizado.startsWith('DIVISAO')) {
      normalizado = 'DIVISAO ' + normalizado;
    }
  }
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza regional para formato padrão: REGIONAL [NOME] - SP
 */
export function normalizarRegionalTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^REGIONAL\s*/, '');
  normalizado = 'REGIONAL ' + normalizado;
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza comando para formato padrão: COMANDO [NOME]
 */
export function normalizarComandoTexto(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^COMANDO\s*/, '');
  normalizado = 'COMANDO ' + normalizado;
  
  return normalizado;
}
