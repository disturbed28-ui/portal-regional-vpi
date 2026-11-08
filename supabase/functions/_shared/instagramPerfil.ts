export const INSTAGRAM_NA = 'N/A';

export interface InstagramValidationResult {
  valid: boolean;
  normalized: string | null;
  error?: string;
}

export function validateInstagram(input: string | null | undefined): InstagramValidationResult {
  const raw = (input ?? '').trim();
  if (!raw) return { valid: false, normalized: null, error: 'Informe seu @ do Instagram ou N/A.' };
  if (/^\s*n[\s./]*a\.?\s*$/i.test(raw)) return { valid: true, normalized: INSTAGRAM_NA };
  const handle = raw.replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
    return { valid: false, normalized: null, error: 'Use apenas letras, números, ponto e underline (até 30 caracteres). Ex: @seuusuario' };
  }
  return { valid: true, normalized: `@${handle}` };
}

export function isInstagramPendente(value: string | null | undefined): boolean {
  return !value || value.trim() === '';
}