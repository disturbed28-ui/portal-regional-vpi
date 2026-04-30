import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useConversationMessages } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  userId: string | undefined;
  otherName: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `ontem ${format(d, "HH:mm")}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
};

export const ChatWindow = ({
  open,
  onOpenChange,
  conversationId,
  userId,
  otherName,
}: ChatWindowProps) => {
  const { messages, loading, sending, sendMessage } = useConversationMessages(
    conversationId,
    userId
  );
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const txt = input.trim();
    if (!txt || sending) return;
    setInput("");
    const result = await sendMessage(txt);
    if (result?.error) {
      // restaurar texto se falhou
      setInput(txt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="text-base">{otherName}</DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/20">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Sem mensagens ainda. Diga olá!
            </p>
          )}
          {messages.map((msg) => {
            const mine = msg.sender_id === userId;
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col max-w-[80%]", mine ? "items-end ml-auto" : "items-start")}
              >
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                  {formatTime(msg.created_at)}
                  {mine && msg.read_at && " ✓✓"}
                  {mine && !msg.read_at && " ✓"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border shrink-0 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem..."
            rows={1}
            className="resize-none min-h-[40px] max-h-[120px]"
            maxLength={4000}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            size="icon"
            className="shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
