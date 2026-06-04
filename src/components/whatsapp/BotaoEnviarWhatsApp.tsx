import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { buildWaMeLink, logEnvioWhatsApp, formatPhoneBR } from "@/lib/whatsapp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BotaoEnviarWhatsAppProps {
  /** Telefone bruto do destinatário (será normalizado). */
  telefone: string | null | undefined;
  /** Nome para exibir no log/UX. */
  destinatarioNome: string;
  /** profile_id do destinatário (opcional, para vínculo). */
  destinatarioProfileId?: string | null;
  /** Mensagem já renderizada (com variáveis substituídas). */
  mensagem: string;
  /** Chave do template usado (para log). */
  templateChave: string;
  templateTitulo?: string | null;
  payload?: Record<string, unknown>;
  moduloOrigem: string;
  regionalId?: string | null;
  divisaoId?: string | null;

  /** Executado após abrir o WhatsApp (ex.: atualizar status). */
  onClickExtra?: () => void | Promise<void>;

  /** Visual */
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  fullWidth?: boolean;
}

/**
 * Botão reutilizável que abre WhatsApp (wa.me) com mensagem pronta
 * e registra log de auditoria. Otimizado para mobile 9:18.
 */
export function BotaoEnviarWhatsApp({
  telefone,
  destinatarioNome,
  destinatarioProfileId,
  mensagem,
  templateChave,
  templateTitulo,
  payload,
  moduloOrigem,
  regionalId,
  divisaoId,
  onClickExtra,
  label = "Enviar WhatsApp",
  variant = "default",
  size = "default",
  className,
  fullWidth = false,
}: BotaoEnviarWhatsAppProps) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const phoneFormatted = formatPhoneBR(telefone || "");
  const link = phoneFormatted ? buildWaMeLink(phoneFormatted, mensagem) : null;
  const disabled = !link;

  const handleClick = async () => {
    if (!link || !user) {
      toast.error("Telefone do destinatário não disponível");
      return;
    }
    // Abre WhatsApp via clique em âncora (mais confiável que window.open,
    // que costuma ser bloqueado dentro de iframes/preview).
    const a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener,noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Fallback: se por algum motivo a aba não abrir, tenta window.open.
    setTimeout(() => {
      try {
        window.open(link, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    }, 150);

    // Log assíncrono (não bloqueia)
    logEnvioWhatsApp({
      remetente_profile_id: user.id,
      remetente_nome: profile?.nome_colete ?? null,
      destinatario_profile_id: destinatarioProfileId ?? null,
      destinatario_nome: destinatarioNome,
      destinatario_telefone: phoneFormatted!,
      template_chave: templateChave,
      template_titulo: templateTitulo,
      mensagem_renderizada: mensagem,
      payload,
      modulo_origem: moduloOrigem,
      regional_id: regionalId ?? profile?.regional_id ?? null,
      divisao_id: divisaoId ?? profile?.divisao_id ?? null,
    });

    if (onClickExtra) {
      try {
        await onClickExtra();
      } catch {
        /* tratado no caller */
      }
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={cn(
        "gap-2",
        fullWidth && "w-full",
        !disabled && variant === "default" && "bg-[#25D366] hover:bg-[#25D366]/90 text-white",
        className,
      )}
      title={disabled ? "Telefone não cadastrado" : `Enviar para ${destinatarioNome}`}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Button>
  );
}
