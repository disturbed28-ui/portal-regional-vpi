import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  UserCheck,
  Send,
  Award,
  ArrowUpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AprovacaoEstagio {
  id: string;
  nivel: number;
  tipo_aprovador: string;
  aprovador_integrante_id: string | null;
  aprovador_nome_colete: string | null;
  aprovador_cargo: string | null;
  status: string;
  data_hora_acao: string | null;
  justificativa_rejeicao: string | null;
  aprovado_por_escalacao?: boolean;
  justificativa_escalacao?: string | null;
}

interface SolicitacaoAprovacaoEstagio {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_regional_id: string | null;
  integrante_cargo_atual: string;
  cargo_estagio_nome: string;
  cargo_estagio_id: string;
  grau_estagio: string;
  solicitante_nome_colete: string;
  solicitante_cargo: string | null;
  solicitante_divisao_texto: string | null;
  created_at: string;
  tempo_estagio_meses: number;
  data_termino_previsto: string;
  data_inicio_estagio: string;
  aprovacoes: AprovacaoEstagio[];
  aprovacaoAtual: AprovacaoEstagio | null;
  isAprovadorDaVez: boolean;
  podeDRescalar: boolean;
}

interface CardAprovacaoEstagioProps {
  solicitacao: SolicitacaoAprovacaoEstagio;
  onAprovar?: (aprovacaoId: string, solicitacaoId: string) => void;
  onRejeitar?: (aprovacaoId: string, solicitacaoId: string) => void;
  onAprovarPorEscalacao?: (
    aprovacaoId: string, 
    solicitacaoId: string, 
    aprovadorNome: string | null, 
    tipoAprovador: string
  ) => void;
  operando: boolean;
  readOnly?: boolean;
}

const TIPO_APROVADOR_LABEL_V: Record<string, string> = {
  diretor_regional: '1. Diretor Regional'
};

const TIPO_APROVADOR_LABEL_VI: Record<string, string> = {
  diretor_divisao: '1. Diretor da Divisão',
  responsavel_regional: '2. Responsável Regional',
  diretor_regional: '3. Diretor Regional'
};

export function CardAprovacaoEstagio({
  solicitacao,
  onAprovar,
  onRejeitar,
  onAprovarPorEscalacao,
  operando,
  readOnly = false
}: CardAprovacaoEstagioProps) {

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  }

  function getStatusBadge(status: string, isAtual: boolean, aprovadoPorEscalacao?: boolean) {
    if (status === 'aprovado') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {aprovadoPorEscalacao ? 'Aprovado (Escalação)' : 'Aprovado'}
        </Badge>
      );
    }
    if (status === 'reprovado') {
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
          <Clock className="h-3 w-3 mr-1" />
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

  const tipoAprovadorLabel = solicitacao.grau_estagio === 'V' 
    ? TIPO_APROVADOR_LABEL_V 
    : TIPO_APROVADOR_LABEL_VI;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Header com badge de grau */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Award className="h-3 w-3 mr-1" />
            Estágio Grau {solicitacao.grau_estagio}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Solicitado em {formatDateTime(solicitacao.created_at)}
          </span>
        </div>

        {/* Dados do integrante */}
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{solicitacao.integrante_nome_colete}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{solicitacao.integrante_divisao_texto}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{solicitacao.integrante_regional_texto}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span>{solicitacao.integrante_cargo_atual}</span>
          </div>
        </div>

        <Separator />

        {/* Dados do estágio */}
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="font-medium">Cargo Estágio: {solicitacao.cargo_estagio_nome}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Início: {formatDate(solicitacao.data_inicio_estagio)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Duração: {solicitacao.tempo_estagio_meses} meses</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Término previsto: {formatDate(solicitacao.data_termino_previsto)}</span>
          </div>
        </div>

        <Separator />

        {/* Solicitante */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Send className="h-4 w-4" />
          <span>
            Solicitado por: {solicitacao.solicitante_nome_colete}
            {solicitacao.solicitante_cargo && ` - ${solicitacao.solicitante_cargo}`}
          </span>
        </div>

        <Separator />

        {/* Lista de aprovações */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {solicitacao.grau_estagio === 'V' ? 'Aprovação' : 'Aprovações'}
          </h4>
          
          {solicitacao.aprovacoes.map((aprovacao) => {
            const isAtual = solicitacao.aprovacaoAtual?.id === aprovacao.id;
            
            return (
              <div 
                key={aprovacao.id}
                className={`p-3 rounded-lg border ${
                  isAtual 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border/50 bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {tipoAprovadorLabel[aprovacao.tipo_aprovador] || aprovacao.tipo_aprovador}
                  </span>
                  {getStatusBadge(aprovacao.status, isAtual, aprovacao.aprovado_por_escalacao)}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  <span>
                    {aprovacao.aprovador_nome_colete || 'Não definido'}
                    {aprovacao.aprovador_cargo && ` - ${aprovacao.aprovador_cargo}`}
                  </span>
                </div>

                {aprovacao.data_hora_acao && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {aprovacao.status === 'aprovado' ? 'Aprovado em: ' : 'Rejeitado em: '}
                    {formatDateTime(aprovacao.data_hora_acao)}
                  </div>
                )}

                {aprovacao.justificativa_rejeicao && (
                  <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-600">
                    <strong>Motivo:</strong> {aprovacao.justificativa_rejeicao}
                  </div>
                )}

                {aprovacao.aprovado_por_escalacao && aprovacao.justificativa_escalacao && (
                  <div className="mt-2 p-2 bg-amber-500/10 rounded text-sm text-amber-700">
                    <strong>Escalação:</strong> {aprovacao.justificativa_escalacao}
                  </div>
                )}

                {/* Botões de ação - Aprovador da vez */}
                {isAtual && solicitacao.isAprovadorDaVez && !readOnly && onAprovar && onRejeitar && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => onAprovar(aprovacao.id, solicitacao.id)}
                      disabled={operando}
                      className="flex-1"
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
                      variant="destructive"
                      onClick={() => onRejeitar(aprovacao.id, solicitacao.id)}
                      disabled={operando}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                )}

                {/* Botão de Escalação - DR pode aprovar mesmo não sendo a vez dele */}
                {isAtual && solicitacao.podeDRescalar && !readOnly && onAprovarPorEscalacao && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAprovarPorEscalacao(
                        aprovacao.id, 
                        solicitacao.id, 
                        aprovacao.aprovador_nome_colete,
                        tipoAprovadorLabel[aprovacao.tipo_aprovador] || aprovacao.tipo_aprovador
                      )}
                      disabled={operando}
                      className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    >
                      {operando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ArrowUpCircle className="h-4 w-4 mr-2" />
                          Aprovar por Escalação Hierárquica
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
