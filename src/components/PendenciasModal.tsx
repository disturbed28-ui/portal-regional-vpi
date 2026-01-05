import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes, DeltaDetalhes, EventoCanceladoDetalhes, TreinamentoAprovadorDetalhes, TreinamentoIntegranteDetalhes, AjusteRolesDetalhes } from "@/hooks/usePendencias";

interface PendenciasModalProps {
  pendencias: Pendencia[];
  totalPendencias: number;
}

const MensalidadeDetalhesCard = ({ detalhes }: { detalhes: MensalidadeDetalhes }) => {
  const formatarValor = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  
  const formatarData = (data: string) => 
    format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
  
  // Verificar se há alguma parcela com 80+ dias de atraso (risco de desligamento)
  const maiorAtraso = Math.max(...detalhes.parcelas.map(p => p.dias_atraso));
  const isCritico = maiorAtraso >= 80;
  
  return (
    <Card className="bg-background/50 border-destructive/20">
      <CardContent className="p-4 space-y-3">
        {/* Alerta Crítico: 80+ dias */}
        {isCritico && (
          <div className="p-3 bg-red-600 text-white rounded-lg border-2 border-red-700 animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">⚠️ RISCO DE DESLIGAMENTO</p>
                <p className="text-xs mt-1">
                  Mensalidade vencida há {maiorAtraso} dias. Limite de 80 dias ultrapassado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cargo do Integrante */}
        {detalhes.cargo_grau_texto && (
          <div className="flex items-center gap-2 p-2 bg-muted border border-border rounded">
            <User className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-foreground">
              <span className="font-medium">Cargo:</span>{' '}
              {detalhes.cargo_grau_texto}
            </div>
          </div>
        )}

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
        <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
          <Calendar className="h-4 w-4 text-destructive" />
          <div className="text-xs text-foreground">
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
            {detalhes.parcelas.map((parcela, idx) => {
              const isParcelaCritica = parcela.dias_atraso >= 80;
              return (
                <div key={idx}>
                  <div 
                    className={`grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 text-xs p-2 rounded ${
                      isParcelaCritica 
                        ? 'bg-red-100 dark:bg-red-950/40 border border-red-600' 
                        : 'bg-secondary/30'
                    }`}
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
                    <div className={`text-right ${isParcelaCritica ? 'text-red-700 font-bold' : 'text-red-600'}`}>
                      {parcela.dias_atraso}d atraso
                    </div>
                  </div>
                  {isParcelaCritica && (
                    <div className="text-xs text-red-700 dark:text-red-400 font-semibold mt-1 ml-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limite crítico ultrapassado
                    </div>
                  )}
                </div>
              );
            })}
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
          <div className="flex items-center gap-2 p-2 bg-muted border border-border rounded">
            <Clock className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-foreground">
              <span className="font-medium">Tempo Afastado:</span>{' '}
              <span className="font-semibold">{detalhes.dias_afastado} dias</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div className="text-xs text-foreground">
              <span className="font-medium">Atraso:</span>{' '}
              <span className="font-semibold text-destructive">{detalhes.dias_atraso} dias</span>
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
  // GUARD CLAUSE - Proteção crítica
  if (!detalhes) {
    console.warn('[DeltaDetalhesCard] Detalhes null recebido');
    return (
      <Card className="bg-background/50 border-gray-500">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            ⚠️ Dados da anomalia não disponíveis no momento.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  const getTipoDeltaInfo = (tipo: string) => {
    const info = {
      'SUMIU_ATIVOS': {
        icon: '🚨',
        label: 'Desapareceu dos Ativos',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10 border border-destructive/20',
      description: 'Integrante não aparece mais na planilha de ativos'
      },
      'NOVO_ATIVOS': {
        icon: '🆕',
        label: 'Novo Integrante Ativo',
      color: 'text-blue-600',
      bgColor: 'bg-muted border border-border',
      description: 'Novo integrante detectado na planilha de ativos'
      },
      'SUMIU_AFASTADOS': {
        icon: '↩️',
        label: 'Saiu dos Afastados',
      color: 'text-green-600',
      bgColor: 'bg-muted border border-border',
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

        {/* Cargo do Integrante */}
        {detalhes.cargo_grau_texto && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cargo</p>
              <p className="text-sm font-medium">{detalhes.cargo_grau_texto}</p>
            </div>
          </div>
        )}
        
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

// Card para Eventos Cancelados/Removidos
const EventoCanceladoDetalhesCard = ({ detalhes }: { detalhes: EventoCanceladoDetalhes }) => {
  const navigate = useNavigate();
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const statusInfo = detalhes.status === 'cancelled' 
    ? { icon: '📅', text: 'Cancelado no Google Calendar', color: 'amber' }
    : { icon: '❌', text: 'Removido do Google Calendar', color: 'red' };

  return (
    <Card className="bg-background/50 border-amber-500">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
          <span className="text-2xl">{statusInfo.icon}</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-700 dark:text-amber-400">{statusInfo.text}</p>
            <p className="text-xs text-muted-foreground">
              Este evento tem {detalhes.total_presencas} presença(s) registrada(s) que impactam o aproveitamento
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Data:</span>{' '}
              <span className="font-medium">{formatarData(detalhes.data_evento)}</span>
            </div>
          </div>
          
          {detalhes.divisao_nome && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Divisão:</span>{' '}
                <span className="font-medium">{detalhes.divisao_nome}</span>
              </div>
            </div>
          )}
        </div>

        <Button 
          size="sm" 
          variant="outline"
          className="w-full"
          onClick={() => navigate('/admin/eventos-agenda-pendentes')}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Gerenciar eventos pendentes
        </Button>
      </CardContent>
    </Card>
  );
};

// Card para Pendência de Treinamento - Aprovadores
const TreinamentoAprovadorDetalhesCard = ({ detalhes }: { detalhes: TreinamentoAprovadorDetalhes }) => {
  const navigate = useNavigate();
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Card className="bg-card border-purple-500/50">
      <CardContent className="p-4 space-y-3">
        {/* Título */}
        <div className="flex items-center gap-2 p-3 bg-purple-950/30 rounded border border-purple-700/50">
          <span className="text-2xl">🎓</span>
          <div className="flex-1">
            <p className="font-semibold text-purple-400">
              Pendência de Aprovação de Treinamento
            </p>
            <p className="text-xs text-muted-foreground">Aguardando aprovações</p>
          </div>
        </div>

        {/* Dados do Integrante */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Integrante:</span>
            <span className="font-medium text-foreground">{detalhes.integrante_nome_colete}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Cargo Treinamento:</span>
            <span className="font-medium text-foreground">{detalhes.cargo_treinamento}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Divisão / Regional:</span>
            <span className="font-medium text-foreground">{detalhes.divisao_texto}</span>
          </div>
        </div>

        {/* Aprovadores Pendentes */}
        {detalhes.aprovadores_pendentes.length > 0 && (
          <div className="p-2 bg-amber-950/30 rounded border border-amber-700/50">
            <p className="text-xs font-semibold mb-1 text-amber-400">Aprovações Pendentes:</p>
            <div className="flex flex-wrap gap-1">
              {detalhes.aprovadores_pendentes.map((nome, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-amber-700/50 text-amber-300">
                  {nome}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Botão de Ação */}
        <Button 
          size="sm" 
          variant="outline"
          className="w-full"
          onClick={() => navigate('/gestao-adm?mainTab=treinamento&subTab=pendentes')}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Ir para Aprovações Pendentes
        </Button>
      </CardContent>
    </Card>
  );
};

// Card para Pendência de Treinamento - Integrante
const TreinamentoIntegranteDetalhesCard = ({ detalhes }: { detalhes: TreinamentoIntegranteDetalhes }) => {
  return (
    <Card className="bg-card border-blue-500/50">
      <CardContent className="p-4 space-y-3">
        {/* Título */}
        <div className="flex items-center gap-2 p-3 bg-blue-950/30 rounded border border-blue-700/50">
          <span className="text-2xl">🎓</span>
          <div className="flex-1">
            <p className="font-semibold text-blue-400">
              Treinamento aguardando aprovação
            </p>
            <p className="text-xs text-muted-foreground">
              Seu treinamento ainda não foi aprovado e ainda não foi iniciado.
            </p>
          </div>
        </div>

        {/* Dados do Treinamento */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Cargo em Treinamento:</span>
            <span className="font-medium text-foreground">{detalhes.cargo_treinamento}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Divisão:</span>
            <span className="font-medium text-foreground">{detalhes.divisao_texto}</span>
          </div>
        </div>

        {/* Orientação */}
        <div className="p-3 bg-amber-950/30 rounded border border-amber-700/50">
          <p className="text-xs text-amber-300">
            <strong>Orientação:</strong> Acione seu Diretor de Divisão para acompanhamento.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <User className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-foreground">{detalhes.diretor_divisao_nome}</span>
            <span className="text-xs text-muted-foreground">({detalhes.diretor_divisao_cargo})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Card para Pendência de Ajuste de Roles
const AjusteRolesDetalhesCard = ({ detalhes }: { detalhes: AjusteRolesDetalhes }) => {
  const navigate = useNavigate();
  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Card className="bg-card border-emerald-500/50">
      <CardContent className="p-4 space-y-3">
        {/* Título */}
        <div className="flex items-center gap-2 p-3 bg-emerald-950/30 rounded border border-emerald-700/50">
          <span className="text-2xl">🔐</span>
          <div className="flex-1">
            <p className="font-semibold text-emerald-400">
              Ajuste de Permissões Necessário
            </p>
            <p className="text-xs text-muted-foreground">
              Cargo alterado - permissões precisam ser atualizadas
            </p>
          </div>
        </div>

        {/* Alteração de Cargo */}
        <div className="p-3 bg-muted rounded border">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Alteração de Cargo:</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {detalhes.cargo_anterior || 'N/A'} (Grau {detalhes.grau_anterior || '-'})
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="text-xs bg-emerald-600">
              {detalhes.cargo_novo} (Grau {detalhes.grau_novo || '-'})
            </Badge>
          </div>
        </div>

        {/* Detalhes */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Alterado por:</span>
            <span className="font-medium text-foreground">{detalhes.alterado_por_nome}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium text-foreground">{formatarData(detalhes.created_at)}</span>
          </div>
        </div>

        {/* Justificativa */}
        <div className="pt-2 border-t">
          <p className="text-xs font-semibold mb-1">Justificativa:</p>
          <p className="text-xs text-muted-foreground italic">{detalhes.justificativa}</p>
        </div>

        {/* Botão de Ação */}
        <Button 
          size="sm" 
          variant="default"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => navigate('/admin/integrantes')}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Ajustar Permissões
        </Button>
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
  const navigate = useNavigate();
  const isMensalidade = pendencia.tipo === 'mensalidade';
  const isAfastamento = pendencia.tipo === 'afastamento';
  const isDelta = pendencia.tipo === 'delta';
  const isEventoCancelado = pendencia.tipo === 'evento_cancelado';
  const isTreinamentoAprovador = pendencia.tipo === 'treinamento_aprovador';
  const isTreinamentoIntegrante = pendencia.tipo === 'treinamento_integrante';
  const isAjusteRoles = pendencia.tipo === 'ajuste_roles';
  const detalhes = pendencia.detalhes_completos;
  
  // LOG DE DEBUG TEMPORÁRIO
  if (isDelta && !detalhes) {
    console.warn('[PendenciaItem] Delta sem detalhes_completos:', {
      nome_colete: pendencia.nome_colete,
      registro_id: pendencia.registro_id,
      tipo: pendencia.tipo,
      detalhe: pendencia.detalhe
    });
  }
  
  // Calcular se é mensalidade crítica (80+ dias)
  const maiorAtrasoMensalidade = isMensalidade 
    ? Math.max(...(detalhes as MensalidadeDetalhes).parcelas.map(p => p.dias_atraso))
    : 0;
  const isCritico = isMensalidade && maiorAtrasoMensalidade >= 80;
  
  const getBorderColor = () => {
    if (isAjusteRoles) return 'border-emerald-500';
    if (isMensalidade && isCritico) return 'border-red-700';
    if (isMensalidade) return 'border-red-500';
    if (isAfastamento) return 'border-orange-500';
    if (isEventoCancelado) return 'border-amber-500';
    if (isTreinamentoAprovador) return 'border-purple-500';
    if (isTreinamentoIntegrante) return 'border-blue-500';
    if (isDelta) {
      const deltaDetalhes = detalhes as DeltaDetalhes | null;
      if (!deltaDetalhes) return 'border-gray-500';
      if (deltaDetalhes.prioridade === 1) return 'border-red-600';
      return 'border-blue-500';
    }
    return 'border-gray-500';
  };
  
  const getIcon = () => {
    if (isAjusteRoles) return '🔐';
    if (isMensalidade) return '💰';
    if (isAfastamento) return '🏥';
    if (isTreinamentoAprovador || isTreinamentoIntegrante) return '🎓';
    if (isEventoCancelado) {
      const eventDetalhes = detalhes as EventoCanceladoDetalhes;
      return eventDetalhes?.status === 'cancelled' ? '📅' : '❌';
    }
    if (isDelta) {
      const deltaDetalhes = detalhes as DeltaDetalhes | null;
      if (!deltaDetalhes || !deltaDetalhes.tipo_delta) return '❓';
      const tipo = deltaDetalhes.tipo_delta;
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
    if (isAjusteRoles) return 'Ajuste Permissões';
    if (isMensalidade) return 'Mensalidade';
    if (isAfastamento) return 'Afastamento';
    if (isEventoCancelado) return 'Evento Cancelado';
    if (isTreinamentoAprovador) return 'Aprovação Treinamento';
    if (isTreinamentoIntegrante) return 'Treinamento';
    if (isDelta) return 'Anomalia';
    return 'Pendência';
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(itemId)}>
      <div className={`rounded-lg bg-secondary/50 hover:bg-secondary border-l-4 ${getBorderColor()}`}>
        {/* Cabeçalho clicável */}
        <CollapsibleTrigger className="w-full">
          {/* Layout Mobile: Empilhado verticalmente */}
          <div className="md:hidden p-3 space-y-2">
            {/* Linha 1: Nome + Divisão */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate" title={pendencia.nome_colete}>
                  {pendencia.nome_colete}
                </div>
                <div className="text-xs text-muted-foreground truncate" title={pendencia.divisao_texto}>
                  {pendencia.divisao_texto}
                </div>
              </div>
              <div className="flex-shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            
            {/* Linha 2: Badge + Detalhe */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant={isMensalidade ? 'destructive' : isDelta ? 'default' : 'secondary'}
                className="text-xs"
              >
                {getIcon()} {getLabel()}
              </Badge>
              {isCritico && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  ⚠️ RISCO DE DESLIGAMENTO
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate" title={pendencia.detalhe}>
                {pendencia.detalhe}
              </span>
            </div>
          </div>
          
          {/* Layout Desktop: Grid horizontal (mantém o atual) */}
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_2fr_auto] gap-3 p-3 items-center">
            <div className="font-medium truncate text-left" title={pendencia.nome_colete}>
              {pendencia.nome_colete}
            </div>
            <div className="text-sm text-muted-foreground truncate text-left" title={pendencia.divisao_texto}>
              {pendencia.divisao_texto}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isMensalidade ? 'destructive' : isDelta ? 'default' : 'secondary'}
                  className="text-xs truncate"
                >
                  {getIcon()} {getLabel()}
                </Badge>
                {isCritico && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    ⚠️ RISCO DE DESLIGAMENTO
                  </Badge>
                )}
              </div>
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
          <div className="px-3 pb-3 pt-0 space-y-3">
            {isMensalidade && <MensalidadeDetalhesCard detalhes={detalhes as MensalidadeDetalhes} />}
            {isAfastamento && <AfastamentoDetalhesCard detalhes={detalhes as AfastamentoDetalhes} />}
            {isEventoCancelado && detalhes && <EventoCanceladoDetalhesCard detalhes={detalhes as EventoCanceladoDetalhes} />}
            
            {/* PROTEÇÃO ADICIONADA */}
            {isDelta && detalhes && <DeltaDetalhesCard detalhes={detalhes as DeltaDetalhes} />}
            {isDelta && !detalhes && (
              <Card className="bg-background/50 border-gray-500">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Dados da anomalia não disponíveis.
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Cards de Treinamento */}
            {isTreinamentoAprovador && detalhes && <TreinamentoAprovadorDetalhesCard detalhes={detalhes as TreinamentoAprovadorDetalhes} />}
            {isTreinamentoIntegrante && detalhes && <TreinamentoIntegranteDetalhesCard detalhes={detalhes as TreinamentoIntegranteDetalhes} />}
            
            {/* Card de Ajuste de Roles */}
            {isAjusteRoles && detalhes && <AjusteRolesDetalhesCard detalhes={detalhes as AjusteRolesDetalhes} />}
            
            {/* Botão Resolver para Anomalias */}
            {isDelta && (
              <Button 
                onClick={() => navigate('/admin/integrantes')}
                className="w-full"
                variant="default"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Ir para Tela de Resolução
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const PendenciasModal = ({ pendencias, totalPendencias }: PendenciasModalProps) => {
  const navigate = useNavigate();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  
  const totalAnomalias = pendencias.filter(p => p.tipo === 'delta').length;
  
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
      
      <DialogContent className="sm:max-w-3xl max-h-[85vh] w-[95vw] sm:w-full" aria-describedby="pendencias-description">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Pendências ({totalPendencias})
            </DialogTitle>
            
            {/* Botão Ver Todas as Anomalias */}
            {totalAnomalias > 0 && (
              <Button 
                onClick={() => navigate('/admin/integrantes')}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Ver Todas as Anomalias
              </Button>
            )}
          </div>
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
