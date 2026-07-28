import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  renderTemplate,
  logEnvioWhatsApp,
  formatPhoneBR,
  openWhatsAppConversation,
  isMobileWhatsAppEnvironment,
} from "@/lib/whatsapp";

export interface AtivacaoDestinatario {
  profileId: string;
  nome: string;
  nomeColete: string | null;
  telefone: string | null;
  divisao: string | null;
  cargo: string | null;
  regionalId?: string | null;
  divisaoId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinatario: AtivacaoDestinatario | null;
  remetenteId: string;
  remetenteNome: string | null;
}

export function NotificarAtivacaoDialog({
  open,
  onOpenChange,
  destinatario,
  remetenteId,
  remetenteNome,
}: Props) {
  const [enviando, setEnviando] = useState(false);

  const telefoneOk = !!formatPhoneBR(destinatario?.telefone || "");

  const enviar = async () => {
    if (!destinatario) return;
    const waWindow = isMobileWhatsAppEnvironment() ? null : window.open("", "_blank");
    setEnviando(true);
    try {
      const fone = formatPhoneBR(destinatario.telefone || "");
      if (!fone) {
        waWindow?.close();
        toast.warning("Integrante sem telefone cadastrado", { duration: 6000 });
        return;
      }

      const { data: tpl } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("corpo, titulo")
        .eq("chave", "perfil_ativado")
        .eq("ativo", true)
        .maybeSingle();

      if (!tpl?.corpo) {
        waWindow?.close();
        toast.warning('Template "perfil_ativado" não configurado', { duration: 6000 });
        return;
      }

      const payload = {
        nome_colete: destinatario.nomeColete || destinatario.nome,
        divisao: destinatario.divisao || "—",
        cargo: destinatario.cargo || "—",
        url: window.location.origin,
        remetente: remetenteNome || "",
      };
      const mensagem = renderTemplate(tpl.corpo, payload);

      const abriu = openWhatsAppConversation({ telefone: fone, mensagem, targetWindow: waWindow });
      if (!abriu) {
        waWindow?.close();
        toast.error("Falha ao montar link do WhatsApp", { duration: 6000 });
        return;
      }

      logEnvioWhatsApp({
        remetente_profile_id: remetenteId,
        remetente_nome: remetenteNome,
        destinatario_profile_id: destinatario.profileId,
        destinatario_nome: destinatario.nomeColete || destinatario.nome,
        destinatario_telefone: fone,
        template_chave: "perfil_ativado",
        template_titulo: tpl.titulo,
        mensagem_renderizada: mensagem,
        payload,
        modulo_origem: "admin_ativacao_perfil",
        regional_id: destinatario.regionalId ?? null,
        divisao_id: destinatario.divisaoId ?? null,
      });

      onOpenChange(false);
    } catch (e) {
      console.error("[notificarAtivacao]", e);
      waWindow?.close();
      toast.error("Erro ao notificar integrante", { duration: 6000 });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Perfil ativado
          </DialogTitle>
          <DialogDescription>
            Deseja avisar {destinatario?.nomeColete || destinatario?.nome} via WhatsApp que o acesso
            dele foi liberado?
          </DialogDescription>
        </DialogHeader>

        {!telefoneOk && (
          <p className="text-sm text-muted-foreground">
            Este integrante não possui telefone cadastrado no perfil.
          </p>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={enviar}
            disabled={!telefoneOk || enviando}
            className="gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Notificar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
