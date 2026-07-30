import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate, logEnvioWhatsApp, buildWaMeLink } from "@/lib/whatsapp";
import { useDiretorDivisao } from "@/hooks/useDiretorDivisao";
import type { IntegranteAfastado } from "@/hooks/useAfastados";
import { format } from "date-fns";

const TEMPLATE_CHAVE = "afastamento_retorno_atrasado";

interface Props {
  afastado: IntegranteAfastado;
  userId?: string;
  remetenteNome?: string | null;
  regionalId?: string | null;
}

export const NotificarRetornoAtrasadoButton = ({
  afastado,
  userId,
  remetenteNome,
  regionalId,
}: Props) => {
  const { data: diretor, isLoading } = useDiretorDivisao(afastado.divisao_id);
  const [enviando, setEnviando] = useState(false);

  const handleClick = async () => {
    if (!userId) return;
    if (!diretor?.telefone) {
      toast.warning("Diretor da divisão sem telefone cadastrado", { duration: 6000 });
      return;
    }

    setEnviando(true);
    try {
      const { data: tpl } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("corpo, titulo")
        .eq("chave", TEMPLATE_CHAVE)
        .eq("ativo", true)
        .maybeSingle();

      if (!tpl?.corpo) {
        toast.warning(`Template "${TEMPLATE_CHAVE}" não configurado`, { duration: 6000 });
        return;
      }

      const hoje = new Date();
      const prevista = new Date(afastado.data_retorno_prevista);
      const diasAtraso = Math.max(
        0,
        Math.floor((hoje.getTime() - prevista.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const payload = {
        diretor: diretor.nome ?? "",
        nome_colete: afastado.nome_colete,
        registro_id: afastado.registro_id,
        divisao: afastado.divisao_texto,
        tipo_afastamento: afastado.tipo_afastamento,
        data_afastamento: format(new Date(afastado.data_afastamento), "dd/MM/yyyy"),
        data_retorno_prevista: format(prevista, "dd/MM/yyyy"),
        dias_atraso: diasAtraso,
        observacoes: afastado.observacoes ?? "",
        remetente: remetenteNome ?? "",
      };

      const mensagem = renderTemplate(tpl.corpo, payload);

      const link = buildWaMeLink(diretor.telefone, mensagem);
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

      logEnvioWhatsApp({
        remetente_profile_id: userId,
        remetente_nome: remetenteNome ?? null,
        destinatario_nome: diretor.nome ?? "Diretor de Divisão",
        destinatario_telefone: diretor.telefone,
        template_chave: TEMPLATE_CHAVE,
        template_titulo: tpl.titulo,
        mensagem_renderizada: mensagem,
        payload,
        modulo_origem: "gestao_adm_afastados",
        regional_id: regionalId ?? null,
        divisao_id: afastado.divisao_id,
      });
    } catch (e) {
      console.error("[NotificarRetornoAtrasado]", e);
      
      toast.error("Erro ao notificar Diretor de Divisão", { duration: 6000 });
    } finally {
      setEnviando(false);
    }
  };

  const disabled = enviando || isLoading || !diretor?.telefone || !userId;

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs h-7 shrink-0 gap-1 border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/10"
      onClick={handleClick}
      disabled={disabled}
      title={
        diretor?.telefone
          ? `Notificar ${diretor.nome} via WhatsApp`
          : "Diretor da divisão sem telefone cadastrado"
      }
    >
      {enviando ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MessageCircle className="h-3 w-3" />
      )}
      Notificar DD
    </Button>
  );
};
