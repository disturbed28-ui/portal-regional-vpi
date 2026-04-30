import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, Search, Trash2, UserPlus } from "lucide-react";
import { useConversations, startConversationWith, deleteConversation } from "@/hooks/useChat";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { removeAccents, normalizeSearchTerm } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onSelectConversation: (conversationId: string, otherName: string) => void;
}

interface SearchResult {
  id: string;
  nome_colete: string;
  photo_url: string | null;
}

const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "ontem";
  return format(d, "dd/MM", { locale: ptBR });
};

export const InboxModal = ({ open, onOpenChange, userId, onSelectConversation }: InboxModalProps) => {
  const { conversations, loading, refresh } = useConversations(userId);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset busca quando modal fecha
  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
    }
  }, [open]);

  // Buscar profiles ativos
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const ascii = normalizeSearchTerm(term);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_colete, photo_url")
        .eq("profile_status", "Ativo")
        .ilike("nome_colete", `%${ascii}%`)
        .order("nome_colete")
        .limit(20);
      if (!error && data) {
        setResults(
          (data as SearchResult[]).filter((r) => r.id !== userId)
        );
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, userId]);

  const handleStartChat = async (otherId: string, name: string) => {
    const convId = await startConversationWith(otherId);
    if (!convId) {
      toast({
        title: "Não foi possível abrir conversa",
        description: "Verifique se o usuário está ativo.",
        variant: "destructive",
      });
      return;
    }
    onSelectConversation(convId, removeAccents(name));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Caixa de Mensagens
          </DialogTitle>
        </DialogHeader>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pessoa por nome de colete..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Resultados de busca */}
          {search.trim().length >= 2 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                {searching ? "Buscando..." : `Resultados (${results.length})`}
              </p>
              {!searching && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma pessoa ativa encontrada.
                </p>
              )}
              {results.map((r) => {
                const name = removeAccents(r.nome_colete);
                return (
                  <button
                    key={r.id}
                    onClick={() => handleStartChat(r.id, name)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full bg-secondary border border-border bg-cover bg-center shrink-0"
                      style={{
                        backgroundImage: r.photo_url
                          ? `url(${r.photo_url})`
                          : `url('/images/skull.png')`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{name}</span>
                      <span className="text-xs text-muted-foreground">Iniciar conversa</span>
                    </div>
                    <UserPlus className="h-4 w-4 text-primary shrink-0" />
                  </button>
                );
              })}
              {(conversations.length > 0 || !searching) && (
                <div className="border-t border-border my-2" />
              )}
            </div>
          )}

          {/* Conversas existentes (oculta enquanto busca) */}
          {search.trim().length < 2 && (
            <>
              {loading && conversations.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
              )}
              {!loading && conversations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  Nenhuma conversa ainda.
                  <br />
                  Use a busca acima ou clique em alguém da lista de online.
                </div>
              )}
              {conversations.map((c) => {
                const name = c.other_nome_colete
                  ? removeAccents(c.other_nome_colete)
                  : "Usuário";
                return (
                  <div
                    key={c.id}
                    className="group relative flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition-colors"
                  >
                    <button
                      onClick={() => {
                        onSelectConversation(c.id, name);
                        onOpenChange(false);
                      }}
                      className="flex-1 text-left flex items-center gap-3 min-w-0"
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ id: c.id, name });
                      }}
                      className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir conversa"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa com <strong>{confirmDelete?.name}</strong> e todas as mensagens
              serão removidas permanentemente para os dois lados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmDelete) return;
                setDeleting(true);
                const ok = await deleteConversation(confirmDelete.id);
                setDeleting(false);
                if (ok) {
                  toast({ title: "Conversa excluída" });
                  setConfirmDelete(null);
                  refresh();
                } else {
                  toast({
                    title: "Erro ao excluir conversa",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
