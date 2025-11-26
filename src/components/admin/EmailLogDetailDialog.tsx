import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmailLog } from "@/hooks/useEmailLogs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

interface EmailLogDetailDialogProps {
  log: EmailLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmailLogDetailDialog = ({
  log,
  open,
  onOpenChange,
}: EmailLogDetailDialogProps) => {
  const isMobile = useIsMobile();

  if (!log) return null;

  const content = (
    <div className="space-y-4 py-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Data/Hora</label>
        <p className="text-sm">
          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Tipo de Email</label>
        <p className="text-sm font-mono">{log.tipo.replace(/_/g, ' ')}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Status</label>
        <div className="mt-1">
          <Badge className={log.status === 'enviado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {log.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
          </Badge>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Destinatário</label>
        <div className="mt-1">
          {log.to_nome && <p className="text-sm font-medium">{log.to_nome}</p>}
          <p className="text-xs text-muted-foreground">{log.to_email}</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Assunto</label>
        <p className="text-sm mt-1">{log.subject}</p>
      </div>

      {log.body_preview && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Preview do Conteúdo</label>
          <p className="text-sm mt-1 text-muted-foreground">{log.body_preview}</p>
        </div>
      )}

      {log.error_message && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Mensagem de Erro</label>
          <p className="text-sm mt-1 text-red-600">{log.error_message}</p>
        </div>
      )}

      {log.resend_message_id && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">ID do Resend</label>
          <p className="text-xs font-mono mt-1">{log.resend_message_id}</p>
        </div>
      )}

      {log.related_user_id && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">ID do Usuário Relacionado</label>
          <p className="text-xs font-mono mt-1">{log.related_user_id}</p>
        </div>
      )}

      {log.related_divisao_id && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">ID da Divisão Relacionada</label>
          <p className="text-xs font-mono mt-1">{log.related_divisao_id}</p>
        </div>
      )}

      {log.metadata && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">
            Metadados
          </label>
          <pre className="bg-slate-900 text-green-400 border border-slate-700 rounded-lg p-4 text-xs overflow-x-auto max-h-64 font-mono">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <span>Detalhes do Email</span>
              <Badge className={log.status === 'enviado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {log.status === 'enviado' ? '✓' : '✗'}
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
            <span>Detalhes do Email</span>
            <Badge className={log.status === 'enviado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {log.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
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
