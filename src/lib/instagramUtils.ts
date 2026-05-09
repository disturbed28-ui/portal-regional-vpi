/**
 * Utilitários para validação e normalização do campo Instagram do perfil.
 *
 * - Aceita "N/A" (com variações: NA, N.A, N.A., n/a etc.) → normaliza para "N/A"
 * - Aceita handle do Instagram: começa com @, 1-30 caracteres,
 *   apenas letras/números/ponto/underline. Se vier sem @, adiciona automaticamente.
 */

export const INSTAGRAM_NA = "N/A";

const NA_PATTERN = /^\s*n[\s./]*a\.?\s*$/i;
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export interface InstagramValidationResult {
  valid: boolean;
  normalized: string | null;
  error?: string;
}

export function validateInstagram(input: string | null | undefined): InstagramValidationResult {
  const raw = (input ?? "").trim();

  if (!raw) {
    return { valid: false, normalized: null, error: "Informe seu @ do Instagram ou N/A." };
  }

  // N/A em qualquer variação
  if (NA_PATTERN.test(raw)) {
    return { valid: true, normalized: INSTAGRAM_NA };
  }

  // Handle: tirar @ inicial e validar
  const handle = raw.replace(/^@+/, "");

  if (!HANDLE_PATTERN.test(handle)) {
    return {
      valid: false,
      normalized: null,
      error: "Use apenas letras, números, ponto e underline (até 30 caracteres). Ex: @seuusuario",
    };
  }

  return { valid: true, normalized: `@${handle}` };
}

/** Indica se o campo está pendente de preenchimento. */
export function isInstagramPendente(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}
