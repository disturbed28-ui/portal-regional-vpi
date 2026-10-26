// Regras da frequência ponderada: quais eventos entram no cálculo e qual peso cada tipo carrega.

const TITULO_COMBATE = /combate\s+insano|jiu[\s-]?jitsu|defesa\s+pessoal/i;

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

/**
 * Combate (Jiu-Jitsu / Defesa Pessoal) não conta na frequência dos integrantes.
 * O tipo vem do título do evento, então um título com "Combate Insano" também é
 * ignorado mesmo que o evento tenha sido classificado como "Outros".
 */
export function eventoForaDaFrequencia(evento: {
  tipo_evento?: string | null;
  titulo?: string | null;
}): boolean {
  const tipo = semAcento((evento.tipo_evento || '').trim());
  if (tipo === 'COMBATE') return true;
  return TITULO_COMBATE.test(evento.titulo || '');
}

/** Lista de eventos que entram no cálculo da frequência. */
export function eventosDaFrequencia<T extends { tipo_evento?: string | null; titulo?: string | null }>(
  eventos: T[] | null | undefined
): T[] {
  return (eventos || []).filter((evento) => !eventoForaDaFrequencia(evento));
}

/** O banco devolve o peso como texto ("0.5000"); converte e usa o padrão quando não há peso. */
export function numeroOuPadrao(valor: unknown, padrao: number): number {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

/** Peso do tipo de evento; tipos sem peso configurado (Caveira, Outros) valem 1. */
export function pesoDoEvento(
  tipoPeso: string | null | undefined,
  pesos: Map<string, unknown> | Record<string, unknown>
): number {
  if (!tipoPeso) return 1;
  const bruto = pesos instanceof Map ? pesos.get(tipoPeso) : (pesos as Record<string, unknown>)[tipoPeso];
  return numeroOuPadrao(bruto, 1);
}
