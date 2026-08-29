/**
 * Regras e cálculos reutilizáveis do módulo Controle de Insights.
 *
 * IMPORTANTE: toda a regra de participação vive aqui.
 * Etapas futuras (Relatórios / Avaliação do Integrante) devem importar
 * estas funções em vez de recriar a lógica.
 */

export type InsightStatus = 'RESPONDEU' | 'NAO_RESPONDEU' | 'NAO_APLICAVEL';

export const INSIGHT_STATUS_LABEL: Record<InsightStatus, string> = {
  RESPONDEU: 'Respondeu',
  NAO_RESPONDEU: 'Não respondeu',
  NAO_APLICAVEL: 'N/A',
};

/**
 * A resposta ao Insight é obrigatória somente para:
 * - Grau X (Camiseta / PP)
 * - Grau IX (Meio Escudo)
 */
export const grauObrigatorio = (grau: string | null | undefined): boolean => {
  const g = (grau || '').trim().toUpperCase();
  return g === 'IX' || g === 'X';
};

/** Status inicial padrão conforme o grau do integrante. */
export const statusPadraoPorGrau = (grau: string | null | undefined): InsightStatus =>
  grauObrigatorio(grau) ? 'NAO_RESPONDEU' : 'NAO_APLICAVEL';

/** Alterna o status ao toque: N/A -> Respondeu -> Não respondeu -> N/A */
export const proximoStatus = (atual: InsightStatus): InsightStatus => {
  if (atual === 'NAO_APLICAVEL') return 'RESPONDEU';
  if (atual === 'RESPONDEU') return 'NAO_RESPONDEU';
  return 'NAO_APLICAVEL';
};

export interface ResumoParticipacao {
  respondeu: number;
  naoRespondeu: number;
  naoAplicavel: number;
  /** Denominador: respondeu + naoRespondeu (N/A nunca entra) */
  aplicaveis: number;
  /** 0-100, null quando não há registros aplicáveis */
  percentual: number | null;
}

/**
 * Participação = RESPONDEU / (RESPONDEU + NAO_RESPONDEU) * 100
 * Registros N/A são completamente desconsiderados do denominador.
 */
export const calcularParticipacao = (
  statuses: Array<InsightStatus | null | undefined>
): ResumoParticipacao => {
  let respondeu = 0;
  let naoRespondeu = 0;
  let naoAplicavel = 0;

  for (const s of statuses) {
    if (s === 'RESPONDEU') respondeu++;
    else if (s === 'NAO_RESPONDEU') naoRespondeu++;
    else if (s === 'NAO_APLICAVEL') naoAplicavel++;
  }

  const aplicaveis = respondeu + naoRespondeu;

  return {
    respondeu,
    naoRespondeu,
    naoAplicavel,
    aplicaveis,
    percentual: aplicaveis > 0 ? (respondeu / aplicaveis) * 100 : null,
  };
};

export const formatarPercentual = (valor: number | null): string =>
  valor === null
    ? '—'
    : `${valor.toFixed(1).replace('.', ',').replace(',0', '')}%`;

/** Agrupa registros por uma chave e calcula a participação de cada grupo. */
export const agruparParticipacao = <T>(
  registros: T[],
  chave: (r: T) => string,
  status: (r: T) => InsightStatus
): Map<string, ResumoParticipacao> => {
  const buckets = new Map<string, InsightStatus[]>();
  for (const r of registros) {
    const k = chave(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(status(r));
  }
  const resultado = new Map<string, ResumoParticipacao>();
  buckets.forEach((lista, k) => resultado.set(k, calcularParticipacao(lista)));
  return resultado;
};
