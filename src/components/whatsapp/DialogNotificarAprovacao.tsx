import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildWaMeLink, logEnvioWhatsApp, renderTemplate } from "@/lib/whatsapp";
import type { NotificacaoFluxo } from "@/lib/notificacaoFluxoAprovacao";

interface Props {
  notificacao: NotificacaoFluxo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  remetenteNome?: string | null;
}

/**
 * Diálogo padrão para notificar via WhatsApp o próximo responsável do fluxo
 * de aprovação (Treinamento/Estágio) ou o Diretor de Divisão na conclusão.
 * Nunca bloqueia o fluxo: o usuário pode fechar sem enviar.
 */
export function DialogNotificarAprovacao({
  notificacao,
  open,
  onOpenChange,
  userId,
  remetenteNome,
}: Props) {
  const [mensagem, setMensagem] = useState<string>("");
  const [tituloTemplate, setTituloTemplate] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!open || !notificacao) return;
      setCarregando(true);
      setMensagem("");
      const { data: tpl } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("corpo, titulo")
        .eq("chave", notificacao.templateChave)
        .eq("ativo", true)
        .maybeSingle();

      if (cancelado) return;
      if (!tpl?.corpo) {
        toast.warning(`Template "${notificacao.templateChave}" não configurado`, {
          duration: 6000,
        });
        setCarregando(false);
        return;
      }
      setTituloTemplate(tpl.titulo ?? null);
      setMensagem(
        renderTemplate(tpl.corpo, {
          ...notificacao.payload,
          remetente: remetenteNome ?? notificacao.payload.remetente ?? "",
        }),
      );
      setCarregando(false);
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [open, notificacao, remetenteNome]);

  const semTelefone = !notificacao?.destinatarioTelefone;

  const handleEnviar = async () => {
    if (!notificacao || !notificacao.destinatarioTelefone || !mensagem) return;
    setEnviando(true);
    try {
      const link = buildWaMeLink(notificacao.destinatarioTelefone, mensagem);
      if (!link) {
        toast.error("Falha ao montar link do WhatsApp", { duration: 6000 });
        return;
      }
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener,noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();

      if (userId) {
        logEnvioWhatsApp({
          remetente_profile_id: userId,
          remetente_nome: remetenteNome ?? null,
          destinatario_profile_id: notificacao.destinatarioProfileId,
          destinatario_nome: notificacao.destinatarioNome,
          destinatario_telefone: notificacao.destinatarioTelefone,
          template_chave: notificacao.templateChave,
          template_titulo: tituloTemplate,
          mensagem_renderizada: mensagem,
          payload: notificacao.payload,
          modulo_origem: notificacao.moduloOrigem,
          regional_id: notificacao.regionalId,
          divisao_id: notificacao.divisaoId,
        });
      }
      onOpenChange(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {notificacao?.concluido ? (
              <CheckCircle2 className="h-5 w-5 text-[#25D366]" />
            ) : (
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
            )}
            {notificacao?.concluido
              ? "Notificar Diretor de Divisão"
              : "Notificar próximo aprovador"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {notificacao?.concluido
              ? "Todas as etapas foram aprovadas. Avise o diretor responsável pelo integrante."
              : "Envie um aviso via WhatsApp para o responsável desta etapa de aprovação."}
          </DialogDescription>
        </DialogHeader>

        {notificacao && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/50 p-3 space-y-1">
              <p className="text-sm font-medium">{notificacao.destinatarioNome}</p>
              {notificacao.destinatarioCargo && (
                <p className="text-xs text-muted-foreground">{notificacao.destinatarioCargo}</p>
              )}
              {!notificacao.concluido && (
                <Badge variant="secondary" className="text-[10px]">
                  Etapa {String(notificacao.payload.etapa)} de{" "}
                  {String(notificacao.payload.total_etapas)}
                </Badge>
              )}
            </div>

            {semTelefone ? (
              <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-xs text-destructive">
                  {notificacao.destinatarioNome} não possui telefone cadastrado no Portal.
                  Solicite ao ADM regional a atualização do contato.
                </p>
              </div>
            ) : carregando ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">Preparando mensagem...</span>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg bg-muted/40 p-3">
                <p className="text-xs whitespace-pre-wrap text-muted-foreground">{mensagem}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            disabled={semTelefone || carregando || enviando || !mensagem}
            onClick={handleEnviar}
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
