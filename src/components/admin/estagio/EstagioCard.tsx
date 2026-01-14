import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, Calendar, CheckCircle, XCircle, UserCheck, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EstagioHistorico } from "@/hooks/useHistoricoEstagio";

interface EstagioCardProps {
  estagio: EstagioHistorico;
}

export const EstagioCard = ({ estagio }: EstagioCardProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = () => {
    if (estagio.status === "Em Andamento") {
      return (
        <Badge className="bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30">
          Em Andamento
        </Badge>
      );
    }

    if (estagio.tipo_encerramento?.includes("com aproveitamento")) {
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
              {estagio.integrante_nome_colete}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Cargo e Grau */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{estagio.cargo_estagio_nome}</span>
          {estagio.grau_estagio && (
            <Badge variant="outline" className="text-xs ml-1">
              <GraduationCap className="h-3 w-3 mr-1" />
              Grau {estagio.grau_estagio}
            </Badge>
          )}
        </div>

        {/* Datas */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Início: {formatDate(estagio.data_inicio)}</span>
          </div>
          {estagio.data_encerramento && (
            <div className="flex items-center gap-2 pl-5">
              <span>Encerramento: {formatDate(estagio.data_encerramento)}</span>
            </div>
          )}
        </div>

        {/* Solicitante */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
          <UserCheck className="h-3 w-3 shrink-0" />
          <span>Solicitante: {estagio.solicitante_nome_colete}</span>
        </div>
      </CardContent>
    </Card>
  );
};
