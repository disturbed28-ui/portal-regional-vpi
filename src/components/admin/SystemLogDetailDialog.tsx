import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { SystemLog } from "@/hooks/useSystemLogs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface SystemLogDetailDialogProps {
  log: SystemLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SystemLogDetailDialog = ({
  log,
  open,
  onOpenChange,
}: SystemLogDetailDialogProps) => {
  const isMobile = useIsMobile();
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (log?.user_id && open) {
      fetchUserInfo(log.user_id);
    } else {
      setUserInfo(null);
    }
  }, [log?.user_id, open]);

  const fetchUserInfo = async (userId: string) => {
    setLoadingUser(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_colete, name')
        .eq('id', userId)
        .single();

      if (profile) {
        setUserInfo({
          name: profile.nome_colete || profile.name || 'N/A',
          email: userId,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar informações do usuário:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  if (!log) return null;

  const tipoColors: Record<string, string> = {
    AUTH_ERROR: 'bg-red-100 text-red-800',
    PERMISSION_DENIED: 'bg-orange-100 text-orange-800',
    FUNCTION_ERROR: 'bg-yellow-100 text-yellow-800',
    NETWORK_ERROR: 'bg-blue-100 text-blue-800',
    VALIDATION_ERROR: 'bg-purple-100 text-purple-800',
    DATABASE_ERROR: 'bg-pink-100 text-pink-800',
    UNKNOWN_ERROR: 'bg-gray-100 text-gray-800',
  };

  const content = (
    <div className="space-y-4 py-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Data/Hora</label>
        <p className="text-sm">
          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
        <div className="mt-1">
          <Badge className={tipoColors[log.tipo] || 'bg-gray-100 text-gray-800'}>
            {log.tipo}
          </Badge>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Origem</label>
        <p className="text-sm font-mono break-all">{log.origem}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Rota</label>
        <p className="text-sm">{log.rota || 'N/A'}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Usuário</label>
        {log.user_id ? (
          <div className="space-y-1 mt-1">
            <p className="text-xs text-muted-foreground">ID: {log.user_id}</p>
            {loadingUser ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : userInfo ? (
              <p className="text-sm">Nome: {userInfo.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Informações não disponíveis</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não autenticado</p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Mensagem</label>
        <p className="text-sm mt-1">{log.mensagem || 'Sem mensagem'}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">
          Detalhes Técnicos
        </label>
        {log.detalhes ? (
          <pre className="bg-slate-900 text-green-400 border border-slate-700 rounded-lg p-4 text-xs overflow-x-auto max-h-64 font-mono">
            {JSON.stringify(log.detalhes, null, 2)}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum detalhe adicional</p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Email de Notificação</label>
        <div className="mt-1">
          {log.notificacao_enviada ? (
            <Badge className="bg-green-100 text-green-800">✓ Enviado</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600">✗ Não enviado</Badge>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <span>Detalhes do Log</span>
              <Badge className={tipoColors[log.tipo] || 'bg-gray-100 text-gray-800'}>
                {log.tipo}
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs">
              ID: {log.id}
            </SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Detalhes do Log</span>
            <Badge className={tipoColors[log.tipo] || 'bg-gray-100 text-gray-800'}>
              {log.tipo}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            ID: {log.id}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
