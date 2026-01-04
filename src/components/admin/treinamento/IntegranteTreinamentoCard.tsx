import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, MapPin, GraduationCap } from 'lucide-react';

interface IntegranteTreinamentoCardProps {
  integrante: {
    nome_colete: string;
    cargo_grau_texto: string;
    divisao_texto: string;
    cargo_treinamento_id: string | null;
  };
  cargoTreinamentoNome?: string | null;
}

export function IntegranteTreinamentoCard({ 
  integrante, 
  cargoTreinamentoNome 
}: IntegranteTreinamentoCardProps) {
  const emTreinamento = !!integrante.cargo_treinamento_id;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Dados do Integrante</h4>
          {emTreinamento && (
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
              <GraduationCap className="h-3 w-3 mr-1" />
              Em Treinamento
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{integrante.nome_colete}</span>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{integrante.cargo_grau_texto}</span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{integrante.divisao_texto}</span>
          </div>

          {emTreinamento && cargoTreinamentoNome && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <GraduationCap className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-600">
                Treinando para: {cargoTreinamentoNome}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
