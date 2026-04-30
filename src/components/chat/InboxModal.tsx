import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle } from "lucide-react";
import { useConversations } from "@/hooks/useChat";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { removeAccents } from "@/lib/utils";

interface InboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onSelectConversation: (conversationId: string, otherName: string) => void;
}

const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "ontem";
  return format(d, "dd/MM", { locale: ptBR });
};

export const InboxModal = ({ open, onOpenChange, userId, onSelectConversation }: InboxModalProps) => {
  const { conversations, loading } = useConversations(userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Caixa de Mensagens
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading && conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          )}
          {!loading && conversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Nenhuma conversa ainda.
              <br />
              Clique em alguém na lista de online para iniciar.
            </div>
          )}
          {conversations.map((c) => {
            const name = c.other_nome_colete
              ? removeAccents(c.other_nome_colete)
              : "Usuário";
            return (
              <button
                key={c.id}
                onClick={() => {
                  onSelectConversation(c.id, name);
                  onOpenChange(false);
                }}
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full bg-secondary border border-border bg-cover bg-center shrink-0"
                  style={{
                    backgroundImage: c.other_photo_url
                      ? `url(${c.other_photo_url})`
                      : `url('/images/skull.png')`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatWhen(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {c.last_message_preview || "Sem mensagens"}
                    </p>
                    {c.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
