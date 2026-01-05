import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, MapPin, Award } from 'lucide-react';

interface IntegranteEstagioCardProps {
  integrante: {
    nome_colete: string;
    cargo_grau_texto: string;
    divisao_texto: string;
    cargo_estagio_id: string | null;
  };
  cargoEstagioNome?: string | null;
  grauEstagio?: string | null;
}

export function IntegranteEstagioCard({ 
  integrante, 
  cargoEstagioNome,
  grauEstagio
}: IntegranteEstagioCardProps) {
  const emEstagio = !!integrante.cargo_estagio_id;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Dados do Integrante</h4>
          {emEstagio && (
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 border-purple-500/30">
              <Award className="h-3 w-3 mr-1" />
              Em Estágio
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

          {emEstagio && cargoEstagioNome && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Award className="h-4 w-4 text-purple-500 shrink-0" />
              <span className="text-sm text-purple-600">
                Estagiando para: {cargoEstagioNome} {grauEstagio && `(Grau ${grauEstagio})`}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
