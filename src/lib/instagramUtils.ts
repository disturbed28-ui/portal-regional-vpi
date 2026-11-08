/**
 * Utilitários para validação e normalização do campo Instagram do perfil.
 *
 * - Aceita "N/A" (com variações: NA, N.A, N.A., n/a etc.) → normaliza para "N/A"
 * - Aceita handle do Instagram: começa com @, 1-30 caracteres,
 *   apenas letras/números/ponto/underline. Se vier sem @, adiciona automaticamente.
 */

export { INSTAGRAM_NA, validateInstagram, isInstagramPendente } from '../../supabase/functions/_shared/instagramPerfil';
export type { InstagramValidationResult } from '../../supabase/functions/_shared/instagramPerfil';
