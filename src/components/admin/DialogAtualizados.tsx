import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useAtualizacoesCarga } from "@/hooks/useAtualizacoesCarga";

interface DialogAtualizadosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargaId: string;
  dataCarga: string;
  totalAtualizados: number;
}

export const DialogAtualizados = ({
  open,
  onOpenChange,
  cargaId,
  dataCarga,
  totalAtualizados
}: DialogAtualizadosProps) => {
  const { data: atualizados, isLoading } = useAtualizacoesCarga(open ? cargaId : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Integrantes Atualizados ({totalAtualizados})</DialogTitle>
          <DialogDescription>
            Alterações da carga em {format(new Date(dataCarga), "dd/MM/yyyy 'às' HH:mm")}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : !atualizados || atualizados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma atualização encontrada</p>
          ) : (
            <div className="space-y-4">
              {atualizados.map((integrante) => (
                <Card key={integrante.registro_id} className="p-4">
                  <h4 className="font-bold text-lg mb-3">
                    {integrante.nome_colete}
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      (#{integrante.registro_id})
                    </span>
                  </h4>
                  
                  <div className="space-y-2">
                    {integrante.alteracoes.map((alt, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm flex-wrap">
                        <Badge variant="outline" className="min-w-[120px]">
                          {alt.label}
                        </Badge>
                        <span className="text-red-600 line-through break-all">{alt.anterior}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-green-600 font-semibold break-all">{alt.novo}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
