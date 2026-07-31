import { useCallback, useState } from "react";
import {
  resolverNotificacaoFluxo,
  type NotificacaoFluxo,
  type TipoFluxo,
} from "@/lib/notificacaoFluxoAprovacao";

/**
 * Controla o diálogo de notificação WhatsApp do fluxo de aprovações
 * (Treinamento/Estágio). Após salvar uma solicitação ou aprovar uma etapa,
 * chame `notificarProximo(solicitacaoId)`.
 */
export function useNotificacaoAprovacaoFluxo(
  tipo: TipoFluxo,
  remetenteNome?: string | null,
) {
  const [notificacao, setNotificacao] = useState<NotificacaoFluxo | null>(null);
  const [open, setOpen] = useState(false);

  const notificarProximo = useCallback(
    async (solicitacaoId: string) => {
      try {
        const resultado = await resolverNotificacaoFluxo(tipo, solicitacaoId, remetenteNome);
        if (!resultado) return;
        setNotificacao(resultado);
        setOpen(true);
      } catch (e) {
        console.error("[useNotificacaoAprovacaoFluxo]", e);
      }
    },
    [tipo, remetenteNome],
  );

  return { notificacao, open, setOpen, notificarProximo };
}
