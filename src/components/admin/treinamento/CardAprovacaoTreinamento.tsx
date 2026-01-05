import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Building2, 
  MapPin, 
  Briefcase, 
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Aprovacao {
  id: string;
  nivel: number;
  tipo_aprovador: string;
  aprovador_integrante_id: string | null;
  aprovador_nome_colete: string | null;
  aprovador_cargo: string | null;
  status: string;
  data_hora_acao: string | null;
  justificativa_rejeicao: string | null;
}

interface SolicitacaoAprovacao {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_cargo_atual: string;
  cargo_treinamento_nome: string;
  cargo_treinamento_id: string;
  solicitante_nome_colete: string;
  solicitante_cargo: string | null;
  solicitante_divisao_texto: string | null;
  created_at: string;
  tempo_treinamento_meses: number;
  data_termino_previsto: string;
  data_inicio_treinamento: string;
  aprovacoes: Aprovacao[];
  aprovacaoAtual: Aprovacao | null;
  isAprovadorDaVez: boolean;
}

interface CardAprovacaoTreinamentoProps {
  solicitacao: SolicitacaoAprovacao;
  onAprovar: (aprovacaoId: string, solicitacaoId: string) => void;
  onRejeitar: (aprovacaoId: string, solicitacaoId: string) => void;
  operando: boolean;
}

const tipoAprovadorLabel: Record<string, string> = {
  diretor_divisao: '1. Diretor da Divisão',
  responsavel_regional: '2. Responsável Regional',
  diretor_regional: '3. Diretor Regional'
};

export function CardAprovacaoTreinamento({ 
  solicitacao, 
  onAprovar, 
  onRejeitar,
  operando 
}: CardAprovacaoTreinamentoProps) {
  
  function formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(dateStr: string): string {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  }

  function getStatusBadge(aprovacao: Aprovacao, isAtual: boolean) {
    if (aprovacao.status === 'aprovado') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aprovado
        </Badge>
      );
    }
    if (aprovacao.status === 'reprovado') {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          Reprovado
        </Badge>
      );
    }
    if (isAtual) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <Clock className="h-3 w-3 mr-1" />
        Aguardando
      </Badge>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Seção: Dados do Treinamento */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <GraduationCap className="h-4 w-4" />
            DADOS DO TREINAMENTO
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Integrante: </span>
                <span className="font-medium">{solicitacao.integrante_nome_colete}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Divisão: </span>
                <span>{solicitacao.integrante_divisao_texto}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Regional: </span>
                <span>{solicitacao.integrante_regional_texto}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Cargo Atual: </span>
                <span>{solicitacao.integrante_cargo_atual}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Cargo Treinamento: </span>
                <span className="font-medium text-primary">{solicitacao.cargo_treinamento_nome}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Período: </span>
                <span>{solicitacao.tempo_treinamento_meses} {solicitacao.tempo_treinamento_meses === 1 ? 'mês' : 'meses'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Término Previsto: </span>
                <span>{formatDate(solicitacao.data_termino_previsto)}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Seção: Dados da Solicitação */}
        <div className="p-4 space-y-3 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            DADOS DA SOLICITAÇÃO
          </div>

          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Solicitante: </span>
              <span className="font-medium">{solicitacao.solicitante_nome_colete}</span>
            </div>

            {solicitacao.solicitante_cargo && (
              <div>
                <span className="text-muted-foreground">Cargo: </span>
                <span>{solicitacao.solicitante_cargo}</span>
              </div>
            )}

            {solicitacao.solicitante_divisao_texto && (
              <div>
                <span className="text-muted-foreground">Divisão: </span>
                <span>{solicitacao.solicitante_divisao_texto}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Data: </span>
              <span>{formatDateTime(solicitacao.created_at)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Seção: Aprovações Pendentes */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            APROVAÇÕES PENDENTES
          </div>

          <div className="space-y-3">
            {solicitacao.aprovacoes.map((aprovacao) => {
              const isAtual = aprovacao.id === solicitacao.aprovacaoAtual?.id;
              const showButtons = isAtual && solicitacao.isAprovadorDaVez && aprovacao.status === 'pendente';

              return (
                <div 
                  key={aprovacao.id} 
                  className={`p-3 rounded-lg border ${
                    isAtual && aprovacao.status === 'pendente'
                      ? 'border-amber-500/50 bg-amber-500/5' 
                      : 'border-border/50 bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {tipoAprovadorLabel[aprovacao.tipo_aprovador] || aprovacao.tipo_aprovador}
                    </span>
                    {getStatusBadge(aprovacao, isAtual)}
                  </div>

                  <div className="text-sm">
                    <p className="font-medium">{aprovacao.aprovador_nome_colete || 'Não definido'}</p>
                    <p className="text-xs text-muted-foreground">{aprovacao.aprovador_cargo || ''}</p>
                  </div>

                  {aprovacao.data_hora_acao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(aprovacao.data_hora_acao)}
                    </p>
                  )}

                  {aprovacao.justificativa_rejeicao && (
                    <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-600">
                      <strong>Justificativa:</strong> {aprovacao.justificativa_rejeicao}
                    </div>
                  )}

                  {showButtons && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                        onClick={() => onAprovar(aprovacao.id, solicitacao.id)}
                        disabled={operando}
                      >
                        {operando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprovar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                        onClick={() => onRejeitar(aprovacao.id, solicitacao.id)}
                        disabled={operando}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
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
}
