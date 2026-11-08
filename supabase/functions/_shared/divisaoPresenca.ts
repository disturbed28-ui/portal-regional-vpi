interface VinculoDivisao {
  divisao_id?: string | null;
  divisao_texto?: string | null;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/** A resolved organizational ID always wins over a stale display label. */
export function pertenceDivisaoPresenca(integrante: VinculoDivisao, divisaoId: string, divisaoNome: string): boolean {
  if (integrante.divisao_id) return integrante.divisao_id === divisaoId;
  const texto = normalizar(integrante.divisao_texto || '');
  return texto.length > 0 && texto === normalizar(divisaoNome);
}