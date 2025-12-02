import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface IntegranteCardProps {
  integrante: {
    id: string;
    nome_colete: string;
    cargo_nome: string | null;
    grau: string | null;
    vinculado: boolean | null;
    ativo: boolean | null;
  };
  onClick: () => void;
}

export const IntegranteCard = ({ integrante, onClick }: IntegranteCardProps) => {
  return (
    <Card 
      className="p-3 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">
            {integrante.nome_colete}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {integrante.cargo_nome || 'Sem cargo'} • Grau {integrante.grau || '-'}
          </p>
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
          {integrante.vinculado && (
            <Badge 
              variant="secondary" 
              className="h-5 px-1.5 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400"
            >
              <Check className="h-3 w-3 mr-0.5" />
              Vinculado
            </Badge>
          )}
          {integrante.ativo === false && (
            <Badge 
              variant="secondary"
              className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-700 dark:text-red-400"
            >
              <X className="h-3 w-3 mr-0.5" />
              Inativo
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
