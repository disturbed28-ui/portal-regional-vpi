import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { EstagiosPorDivisao } from "@/hooks/useHistoricoEstagio";
import { EstagioCard } from "./EstagioCard";

interface DivisaoEstagioCardProps {
  divisao: EstagiosPorDivisao;
}

export const DivisaoEstagioCard = ({ divisao }: DivisaoEstagioCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const emAndamento = divisao.estagios.filter(e => e.status === "Em Andamento").length;
  const concluidos = divisao.estagios.length - emAndamento;

  return (
    <Card className="border-border/50">
      <CardHeader 
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate">
              {divisao.divisao_nome}
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-1.5">
              {emAndamento > 0 && (
                <Badge variant="secondary" className="text-xs bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30">
                  {emAndamento} em andamento
                </Badge>
              )}
              {concluidos > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {concluidos} concluído{concluidos > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-3 pt-0 space-y-2">
          {divisao.estagios.map((estagio) => (
            <EstagioCard key={estagio.id} estagio={estagio} />
          ))}
        </CardContent>
      )}
    </Card>
  );
};
