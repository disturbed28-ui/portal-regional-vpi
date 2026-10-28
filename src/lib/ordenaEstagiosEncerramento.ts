/**
 * Ordenação da aba de Encerramento de Estágio: quem vence primeiro aparece primeiro.
 *
 * Ordena pelo término previsto mais próximo (ascendente). Estágios sem término
 * previsto (ex.: ainda em aprovação) vão para o fim, ordenados pelo início mais
 * antigo. Retorna uma cópia nova, sem alterar a lista recebida.
 */
export interface EstagioParaOrdenar {
  data_termino_previsto: string | null;
  data_inicio_estagio: string | null;
}

const INF = Number.POSITIVE_INFINITY;

function tempoTermino(data: string | null): number {
  if (!data) return INF;
  const t = new Date(data).getTime();
  return Number.isNaN(t) ? INF : t;
}

function tempoInicio(data: string | null): number {
  if (!data) return -INF;
  const t = new Date(data).getTime();
  return Number.isNaN(t) ? -INF : t;
}

export function ordenarPorVencimento<T extends EstagioParaOrdenar>(estagios: readonly T[]): T[] {
  return [...estagios].sort((a, b) => {
    const terminoA = tempoTermino(a.data_termino_previsto);
    const terminoB = tempoTermino(b.data_termino_previsto);
    if (terminoA !== terminoB) return terminoA - terminoB;
    return tempoInicio(a.data_inicio_estagio) - tempoInicio(b.data_inicio_estagio);
  });
}
