import { useState, useCallback } from "react";
import { InboxModal } from "./InboxModal";
import { ChatWindow } from "./ChatWindow";
import { startConversationWith } from "@/hooks/useChat";
import { useToast } from "@/hooks/use-toast";
import { removeAccents } from "@/lib/utils";

interface ChatManagerProps {
  userId: string | undefined;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
  pendingOpenWith: { userId: string; name: string } | null;
  clearPendingOpen: () => void;
}

/**
 * Orquestra abertura de inbox e janela de chat.
 * Recebe pedidos externos de abrir chat com determinado usuário.
 */
export const ChatManager = ({
  userId,
  inboxOpen,
  setInboxOpen,
  pendingOpenWith,
  clearPendingOpen,
}: ChatManagerProps) => {
  const { toast } = useToast();
  const [activeConv, setActiveConv] = useState<{ id: string; name: string } | null>(null);

  const openConversationWithUser = useCallback(
    async (otherUserId: string, name: string) => {
      const convId = await startConversationWith(otherUserId);
      if (!convId) {
        toast({
          title: "Não foi possível abrir conversa",
          description: "Verifique se o usuário está ativo.",
          variant: "destructive",
        });
        return;
      }
      setActiveConv({ id: convId, name: removeAccents(name) });
    },
    [toast]
  );

  // Atender pedido pendente (clique em usuário online)
  if (pendingOpenWith) {
    const req = pendingOpenWith;
    clearPendingOpen();
    openConversationWithUser(req.userId, req.name);
  }

  return (
    <>
      <InboxModal
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        userId={userId}
        onSelectConversation={(id, name) => setActiveConv({ id, name })}
      />
      <ChatWindow
        open={!!activeConv}
        onOpenChange={(o) => !o && setActiveConv(null)}
        conversationId={activeConv?.id ?? null}
        userId={userId}
        otherName={activeConv?.name ?? ""}
      />
    </>
  );
};
