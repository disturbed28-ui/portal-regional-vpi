/**
 * Helpers para envio de notificações via WhatsApp (links wa.me).
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Normaliza telefone para o formato exigido pelo wa.me: dígitos com DDI.
 * Aceita: "11 99999-9999", "(11) 99999-9999", "+55 11 99999-9999", etc.
 * Retorna sempre com DDI 55 (Brasil) prefixado se não estiver presente.
 */
export function formatPhoneBR(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // Se já começa com 55 e tem 12 ou 13 dígitos no total, ok.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Se tem 10 ou 11 dígitos (DDD + número), prefixa com 55.
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  // Caso contrário, retorna como está (provavelmente inválido — caller decide).
  return digits;
}

/**
 * Substitui {{variavel}} pelos valores do payload.
 * Suporta também blocos condicionais simples {{#chave}}...{{/chave}}
 * que aparecem somente se a chave tiver valor truthy.
 */
export function renderTemplate(corpo: string, payload: Record<string, unknown>): string {
  let out = corpo;

  // Blocos condicionais {{#key}}...{{/key}}
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const value = payload[key];
    return value ? inner : "";
  });

  // Substituições simples {{key}}
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = payload[key];
    return value === null || value === undefined ? "" : String(value);
  });

  return out.trim();
}

/**
 * Monta a URL wa.me com mensagem encodada.
 */
export function buildWaMeLink(telefone: string, mensagem: string): string | null {
  const phone = formatPhoneBR(telefone);
  if (!phone) return null;
  const text = encodeURIComponent(mensagem);
  return `https://wa.me/${phone}?text=${text}`;
}

export interface LogEnvioParams {
  remetente_profile_id: string;
  remetente_nome?: string | null;
  destinatario_profile_id?: string | null;
  destinatario_nome: string;
  destinatario_telefone: string;
  template_chave: string;
  template_titulo?: string | null;
  mensagem_renderizada: string;
  payload?: Record<string, unknown>;
  modulo_origem: string;
  regional_id?: string | null;
  divisao_id?: string | null;
}

/**
 * Registra envio de WhatsApp no log de auditoria.
 * Não bloqueia a UX se falhar — apenas loga no console.
 */
export async function logEnvioWhatsApp(params: LogEnvioParams): Promise<void> {
  try {
    const { error } = await supabase.from("notificacoes_whatsapp_log").insert({
      remetente_profile_id: params.remetente_profile_id,
      remetente_nome: params.remetente_nome ?? null,
      destinatario_profile_id: params.destinatario_profile_id ?? null,
      destinatario_nome: params.destinatario_nome,
      destinatario_telefone: formatPhoneBR(params.destinatario_telefone) ?? params.destinatario_telefone,
      template_chave: params.template_chave,
      template_titulo: params.template_titulo ?? null,
      mensagem_renderizada: params.mensagem_renderizada,
      payload: (params.payload as never) ?? {},
      modulo_origem: params.modulo_origem,
      regional_id: params.regional_id ?? null,
      divisao_id: params.divisao_id ?? null,
    });
    if (error) console.error("[whatsapp] erro ao registrar log:", error);
  } catch (e) {
    console.error("[whatsapp] exceção ao registrar log:", e);
  }
}
