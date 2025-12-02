import { romanToNumber } from './grauUtils';

/**
 * Determina o tipo de grau (PP, Full, ou padrão/camiseta)
 * PP vem primeiro, depois Full, depois camiseta
 */
const getTipoGrau = (cargoNome: string | null): number => {
  if (!cargoNome) return 3; // camiseta/padrão
  
  const cargoUpper = cargoNome.toUpperCase();
  
  if (cargoUpper.includes('PP')) return 1; // PP (Peito de Prata)
  if (cargoUpper.includes('FULL')) return 2; // Full
  
  return 3; // camiseta/padrão
};

/**
 * Função de ordenação hierárquica de integrantes
 * Ordem: Cargo → Grau → Tipo (PP/Full/Camiseta) → Data Entrada → Nome
 */
export const ordenarIntegrantes = (a: any, b: any): number => {
  // 1. Por cargo
  const ordemCargos: Record<string, number> = {
    // Regional (Grau V)
    'Diretor Regional': 1,
    'Operacional Regional': 2,
    'Social Regional': 3,
    'Adm. Regional': 4,
    'Comunicação': 5,
    // Divisão (Grau VI)
    'Diretor Divisão': 10,
    'Sub Diretor Divisão': 11,
    'Social Divisão': 12,
    'Adm. Divisão': 13,
    'Sgt.Armas Divisão': 14,
    'Sgt Armas Full': 15,
    'Sgt Armas PP': 16,
  };
  const cargoA = ordemCargos[a.cargo_nome || ''] || 99;
  const cargoB = ordemCargos[b.cargo_nome || ''] || 99;
  if (cargoA !== cargoB) return cargoA - cargoB;
  
  // 2. Por grau (numérico)
  const grauA = romanToNumber(a.grau);
  const grauB = romanToNumber(b.grau);
  if (grauA !== grauB) return grauA - grauB;
  
  // 3. Por tipo de grau (PP → Full → Camiseta)
  const tipoA = getTipoGrau(a.cargo_nome);
  const tipoB = getTipoGrau(b.cargo_nome);
  if (tipoA !== tipoB) return tipoA - tipoB;
  
  // 4. Por data de entrada (mais antigo primeiro)
  const dataA = a.data_entrada ? new Date(a.data_entrada).getTime() : Infinity;
  const dataB = b.data_entrada ? new Date(b.data_entrada).getTime() : Infinity;
  if (dataA !== dataB) return dataA - dataB;
  
  // 5. Por nome (desempate final)
  return (a.nome_colete || '').localeCompare(b.nome_colete || '');
};
