import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, Calendar, CheckCircle, XCircle, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TreinamentoHistorico } from "@/hooks/useHistoricoTreinamento";

interface TreinamentoCardProps {
  treinamento: TreinamentoHistorico;
}

export const TreinamentoCard = ({ treinamento }: TreinamentoCardProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = () => {
    if (treinamento.status === "Em Andamento") {
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          Em Andamento
        </Badge>
      );
    }

    if (treinamento.tipo_encerramento?.includes("com aproveitamento")) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Concluído c/ aproveitamento
        </Badge>
      );
    }

    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Concluído s/ aproveitamento
      </Badge>
    );
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-3 space-y-2">
        {/* Nome e Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate">
              {treinamento.integrante_nome_colete}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Cargo em treinamento */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{treinamento.cargo_treinamento_nome}</span>
        </div>

        {/* Datas */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Início: {formatDate(treinamento.data_inicio)}</span>
          </div>
          {treinamento.data_encerramento && (
            <div className="flex items-center gap-2 pl-5">
              <span>Encerramento: {formatDate(treinamento.data_encerramento)}</span>
            </div>
          )}
        </div>

        {/* Solicitante */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
          <UserCheck className="h-3 w-3 shrink-0" />
          <span>Solicitante: {treinamento.solicitante_nome_colete}</span>
        </div>
      </CardContent>
    </Card>
  );
};
