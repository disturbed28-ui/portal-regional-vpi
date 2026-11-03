/** Numeric club registration IDs, not names or database UUIDs, define identity. */
export function mesmoRegistroIntegrante(antigo: unknown, novo: unknown): boolean {
  return typeof antigo === 'number' && Number.isSafeInteger(antigo) && antigo > 0
    && typeof novo === 'number' && Number.isSafeInteger(novo) && novo === antigo;
}