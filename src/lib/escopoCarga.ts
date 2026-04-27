/**
 * Helper para extrair payload de escopo (Grau) a partir do profile do usuário
 * para envio em chamadas a edge functions de carga.
 */
export interface EscopoCargaPayload {
  user_grau: string | null;
  user_regional_id: string | null;
  user_divisao_id: string | null;
}

export const buildEscopoCargaPayload = (profile: any | null | undefined): EscopoCargaPayload => ({
  user_grau: profile?.integrante?.grau || profile?.grau || null,
  user_regional_id: profile?.regional_id || null,
  user_divisao_id: profile?.divisao_id || null,
});
