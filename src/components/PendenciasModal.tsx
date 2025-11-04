import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle } from "lucide-react";

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento';
  detalhe: string;
  data_ref: string;
}

interface PendenciasModalProps {
  pendencias: Pendencia[];
  totalPendencias: number;
}

export const PendenciasModal = ({ pendencias, totalPendencias }: PendenciasModalProps) => {
  if (totalPendencias === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Bell className="h-5 w-5" />
          {totalPendencias > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {totalPendencias > 99 ? '99+' : totalPendencias}
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Pendências ({totalPendencias})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 overflow-y-auto max-h-[60vh]">
          {pendencias.map((p, idx) => (
            <div 
              key={idx} 
              className="grid grid-cols-[2fr_1.5fr_2fr] gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary border-l-4 border-red-500"
            >
              <div className="font-medium truncate" title={p.nome_colete}>
                {p.nome_colete}
              </div>
              <div className="text-sm text-muted-foreground truncate" title={p.divisao_texto}>
                {p.divisao_texto}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge 
                  variant={p.tipo === 'mensalidade' ? 'destructive' : 'secondary'}
                  className="text-xs truncate"
                >
                  {p.tipo === 'mensalidade' ? '💰 Mensalidade' : '🏥 Afastamento'}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {p.detalhe}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
