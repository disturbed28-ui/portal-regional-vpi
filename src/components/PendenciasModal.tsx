import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Bell, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  User,
  AlertTriangle
} from "lucide-react";
import type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes } from "@/hooks/usePendencias";

interface PendenciasModalProps {
  pendencias: Pendencia[];
  totalPendencias: number;
}

const MensalidadeDetalhesCard = ({ detalhes }: { detalhes: MensalidadeDetalhes }) => {
  const formatarValor = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  
  const formatarData = (data: string) => 
    format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
  
  return (
    <Card className="bg-background/50 border-destructive/20">
      <CardContent className="p-4 space-y-3">
        {/* Resumo Financeiro */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="font-semibold text-red-600">
                {formatarValor(detalhes.valor_total)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total de Parcelas</p>
              <p className="font-semibold">{detalhes.total_parcelas}</p>
            </div>
          </div>
        </div>
        
        {/* Período */}
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
          <Calendar className="h-4 w-4 text-red-600" />
          <div className="text-xs">
            <span className="font-medium">Período:</span>{' '}
            {formatarData(detalhes.primeira_divida)} até {formatarData(detalhes.ultima_divida)}
          </div>
        </div>
        
        {/* Lista de Parcelas */}
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            Parcelas Atrasadas:
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {detalhes.parcelas.map((parcela, idx) => (
              <div 
                key={idx} 
                className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 text-xs p-2 bg-secondary/30 rounded"
              >
                <div>
                  <span className="font-medium">{parcela.ref}</span>
                </div>
                <div className="text-muted-foreground">
                  {formatarData(parcela.data_vencimento)}
                </div>
                <div className="font-medium text-red-600">
                  {formatarValor(parcela.valor)}
                </div>
                <div className="text-right text-red-600">
                  {parcela.dias_atraso}d atraso
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AfastamentoDetalhesCard = ({ detalhes }: { detalhes: AfastamentoDetalhes }) => {
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  
  return (
    <Card className="bg-background/50 border-orange-200 dark:border-orange-800">
      <CardContent className="p-4 space-y-3">
        {/* Informações do Integrante */}
        <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
          <User className="h-4 w-4 text-orange-600" />
          <div className="text-xs">
            <span className="font-medium">Cargo:</span>{' '}
            {detalhes.cargo_grau_texto || 'Não informado'}
          </div>
        </div>
        
        {/* Tipo de Afastamento */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-600" />
          <div>
            <p className="text-xs text-muted-foreground">Tipo de Afastamento</p>
            <p className="font-semibold">{detalhes.tipo_afastamento}</p>
          </div>
        </div>
        
        {/* Timeline */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Início</p>
              <p className="text-sm font-medium">
                {formatarData(detalhes.data_afastamento)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">Retorno Previsto</p>
              <p className="text-sm font-medium">
                {formatarData(detalhes.data_retorno_prevista)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Duração */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
            <Clock className="h-4 w-4 text-blue-600" />
            <div className="text-xs">
              <span className="font-medium">Tempo Afastado:</span>{' '}
              <span className="font-semibold">{detalhes.dias_afastado} dias</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div className="text-xs">
              <span className="font-medium">Atraso:</span>{' '}
              <span className="font-semibold text-red-600">{detalhes.dias_atraso} dias</span>
            </div>
          </div>
        </div>
        
        {/* Observações */}
        {detalhes.observacoes && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold mb-1">Observações:</p>
            <p className="text-xs text-muted-foreground italic">
              {detalhes.observacoes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PendenciaItem = ({ pendencia }: { pendencia: Pendencia }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const isMensalidade = pendencia.tipo === 'mensalidade';
  const detalhes = pendencia.detalhes_completos;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg bg-secondary/50 hover:bg-secondary border-l-4 border-red-500">
        {/* Cabeçalho clicável */}
        <CollapsibleTrigger className="w-full">
          <div className="grid grid-cols-[2fr_1.5fr_2fr_auto] gap-3 p-3 items-center">
            <div className="font-medium truncate text-left" title={pendencia.nome_colete}>
              {pendencia.nome_colete}
            </div>
            <div className="text-sm text-muted-foreground truncate text-left" title={pendencia.divisao_texto}>
              {pendencia.divisao_texto}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Badge 
                variant={isMensalidade ? 'destructive' : 'secondary'}
                className="text-xs truncate"
              >
                {isMensalidade ? '💰 Mensalidade' : '🏥 Afastamento'}
              </Badge>
              <span className="text-xs text-muted-foreground truncate">
                {pendencia.detalhe}
              </span>
            </div>
            <div className="flex items-center justify-center">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        {/* Conteúdo expansível */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            {isMensalidade ? (
              <MensalidadeDetalhesCard detalhes={detalhes as MensalidadeDetalhes} />
            ) : (
              <AfastamentoDetalhesCard detalhes={detalhes as AfastamentoDetalhes} />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const PendenciasModal = ({ pendencias, totalPendencias }: PendenciasModalProps) => {
  if (totalPendencias === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <Bell className="h-5 w-5" />
          {totalPendencias > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {totalPendencias > 99 ? '99+' : totalPendencias}
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Pendências ({totalPendencias})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 overflow-y-auto max-h-[65vh] pr-2">
          {pendencias.map((p, idx) => (
            <PendenciaItem key={idx} pendencia={p} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
