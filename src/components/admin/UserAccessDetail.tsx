import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useUserAccessLogs } from "@/hooks/useUserAccessLogs";
import { ProfileWithAccess } from "@/hooks/useProfilesWithAccess";
import { LogIn, FileText, ArrowLeft, RefreshCw, ChevronDown } from "lucide-react";

interface UserAccessDetailProps {
  user: ProfileWithAccess | null;
  open: boolean;
  onClose: () => void;
}

export const UserAccessDetail = ({ user, open, onClose }: UserAccessDetailProps) => {
  const { logs, loading, hasMore, loadMore, refresh } = useUserAccessLogs(user?.id || null);

  if (!user) return null;

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getEventIcon = (tipo: string) => {
    switch (tipo) {
      case "login":
        return <LogIn className="h-4 w-4 text-green-500" />;
      case "page_view":
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventBadge = (tipo: string) => {
    switch (tipo) {
      case "login":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Login</Badge>;
      case "page_view":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Página</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base truncate">
                {user.nome_colete || user.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                {user.divisao} • {user.cargo} {user.grau}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={refresh} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {loading && logs.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum registro de acesso encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">{getEventIcon(log.tipo_evento)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getEventBadge(log.tipo_evento)}
                      {log.rota && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[150px]">
                          {log.rota}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(log.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Origem: {log.origem}
                    </p>
                  </div>
                </div>
              ))}

              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Carregar mais
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
