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
import type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes, DeltaDetalhes } from "@/hooks/usePendencias";

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
          <div className="text-xs text-gray-900 dark:text-gray-100">
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
          <div className="text-xs text-gray-900 dark:text-gray-100">
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
            <div className="text-xs text-gray-900 dark:text-gray-100">
              <span className="font-medium">Tempo Afastado:</span>{' '}
              <span className="font-semibold">{detalhes.dias_afastado} dias</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div className="text-xs text-gray-900 dark:text-gray-100">
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

const DeltaDetalhesCard = ({ detalhes }: { detalhes: DeltaDetalhes }) => {
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  const getTipoDeltaInfo = (tipo: string) => {
    const info = {
      'SUMIU_ATIVOS': {
        icon: '🚨',
        label: 'Desapareceu dos Ativos',
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        description: 'Integrante não aparece mais na planilha de ativos'
      },
      'NOVO_ATIVOS': {
        icon: '🆕',
        label: 'Novo Integrante Ativo',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        description: 'Novo integrante detectado na planilha de ativos'
      },
      'SUMIU_AFASTADOS': {
        icon: '↩️',
        label: 'Saiu dos Afastados',
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        description: 'Integrante não aparece mais na planilha de afastados'
      },
      'NOVO_AFASTADOS': {
        icon: '⏸️',
        label: 'Novo Afastamento',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20',
        description: 'Novo afastamento detectado na planilha'
      }
    };
    
    return info[tipo as keyof typeof info] || {
      icon: '❓',
      label: tipo,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-950/20',
      description: 'Anomalia detectada'
    };
  };
  
  const deltaInfo = getTipoDeltaInfo(detalhes.tipo_delta);
  
  return (
    <Card className={`bg-background/50 border-${deltaInfo.color.replace('text-', '')}`}>
      <CardContent className="p-4 space-y-3">
        {/* Tipo de Delta */}
        <div className={`flex items-center gap-2 p-3 ${deltaInfo.bgColor} rounded`}>
          <span className="text-2xl">{deltaInfo.icon}</span>
          <div className="flex-1">
            <p className={`font-semibold ${deltaInfo.color}`}>{deltaInfo.label}</p>
            <p className="text-xs text-muted-foreground">{deltaInfo.description}</p>
          </div>
          {detalhes.prioridade === 1 && (
            <Badge variant="destructive" className="text-xs">Alta Prioridade</Badge>
          )}
        </div>
        
        {/* Data de Detecção */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Detectado em</p>
            <p className="text-sm font-medium">{formatarData(detalhes.created_at)}</p>
          </div>
        </div>
        
        {/* Dados Adicionais */}
        {detalhes.dados_adicionais && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-semibold mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Informações Adicionais:
            </p>
            <div className="text-xs space-y-1 bg-secondary/30 p-2 rounded">
              {detalhes.dados_adicionais.origem && (
                <div><span className="font-medium">Origem:</span> {detalhes.dados_adicionais.origem}</div>
              )}
              {detalhes.dados_adicionais.tipo_afastamento && (
                <div><span className="font-medium">Tipo:</span> {detalhes.dados_adicionais.tipo_afastamento}</div>
              )}
              {detalhes.dados_adicionais.data_afastamento && (
                <div>
                  <span className="font-medium">Data Afastamento:</span>{' '}
                  {format(new Date(detalhes.dados_adicionais.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Observação Admin */}
        {detalhes.observacao_admin && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold mb-1">Observação:</p>
            <p className="text-xs text-muted-foreground italic">{detalhes.observacao_admin}</p>
          </div>
        )}
        
        {/* Alerta de Ação */}
        <div className={`p-2 ${deltaInfo.bgColor} rounded border-l-2 ${deltaInfo.color.replace('text-', 'border-')}`}>
          <p className="text-xs font-medium">⚠️ Requer Ação</p>
          <p className="text-xs text-muted-foreground mt-1">
            {detalhes.tipo_delta === 'SUMIU_ATIVOS' && 
              'Verifique se o integrante foi transferido, desligado ou afastado.'}
            {detalhes.tipo_delta === 'NOVO_ATIVOS' && 
              'Confirme se é um novo integrante ou um retorno de afastamento.'}
            {detalhes.tipo_delta === 'SUMIU_AFASTADOS' && 
              'Verifique se o integrante retornou ou se houve erro na planilha.'}
            {detalhes.tipo_delta === 'NOVO_AFASTADOS' && 
              'Confirme o novo afastamento e verifique a data de retorno.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

interface PendenciaItemProps {
  pendencia: Pendencia;
  itemId: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

const PendenciaItem = ({ pendencia, itemId, isOpen, onToggle }: PendenciaItemProps) => {
  const isMensalidade = pendencia.tipo === 'mensalidade';
  const isAfastamento = pendencia.tipo === 'afastamento';
  const isDelta = pendencia.tipo === 'delta';
  const detalhes = pendencia.detalhes_completos;
  
  const getBorderColor = () => {
    if (isMensalidade) return 'border-red-500';
    if (isAfastamento) return 'border-orange-500';
    if (isDelta) {
      const deltaDetalhes = detalhes as DeltaDetalhes;
      if (deltaDetalhes.prioridade === 1) return 'border-red-600';
      return 'border-blue-500';
    }
    return 'border-gray-500';
  };
  
  const getIcon = () => {
    if (isMensalidade) return '💰';
    if (isAfastamento) return '🏥';
    if (isDelta) {
      const tipo = (detalhes as DeltaDetalhes).tipo_delta;
      const icons: Record<string, string> = {
        'SUMIU_ATIVOS': '🚨',
        'NOVO_ATIVOS': '🆕',
        'SUMIU_AFASTADOS': '↩️',
        'NOVO_AFASTADOS': '⏸️'
      };
      return icons[tipo] || '❓';
    }
    return '📋';
  };
  
  const getLabel = () => {
    if (isMensalidade) return 'Mensalidade';
    if (isAfastamento) return 'Afastamento';
    if (isDelta) return 'Anomalia';
    return 'Pendência';
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(itemId)}>
      <div className={`rounded-lg bg-secondary/50 hover:bg-secondary border-l-4 ${getBorderColor()}`}>
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
                variant={isMensalidade ? 'destructive' : isDelta ? 'default' : 'secondary'}
                className="text-xs truncate"
              >
                {getIcon()} {getLabel()}
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
            {isMensalidade && <MensalidadeDetalhesCard detalhes={detalhes as MensalidadeDetalhes} />}
            {isAfastamento && <AfastamentoDetalhesCard detalhes={detalhes as AfastamentoDetalhes} />}
            {isDelta && <DeltaDetalhesCard detalhes={detalhes as DeltaDetalhes} />}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const PendenciasModal = ({ pendencias, totalPendencias }: PendenciasModalProps) => {
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  
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
      
      <DialogContent className="sm:max-w-3xl max-h-[85vh]" aria-describedby="pendencias-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Pendências ({totalPendencias})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 overflow-y-auto max-h-[65vh] pr-2">
          {pendencias.map((p, idx) => (
            <PendenciaItem 
              key={idx} 
              pendencia={p}
              itemId={`${p.tipo}_${p.registro_id}`}
              isOpen={openItemId === `${p.tipo}_${p.registro_id}`}
              onToggle={(id) => setOpenItemId(openItemId === id ? null : id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
