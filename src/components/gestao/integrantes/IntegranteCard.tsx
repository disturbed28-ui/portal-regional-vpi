import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Edit, UserX } from "lucide-react";
import { IntegrantePortal } from "@/hooks/useIntegrantes";

interface IntegranteCardProps {
  integrante: IntegrantePortal;
  onEditar: (integrante: IntegrantePortal) => void;
  onInativar: (integrante: IntegrantePortal) => void;
}

export function IntegranteCard({ integrante, onEditar, onInativar }: IntegranteCardProps) {
  return (
    <Card className="bg-card border-border/50 hover:border-border transition-colors">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          
          {/* Informações */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-foreground truncate">
                {integrante.nome_colete}
              </h4>
              {!integrante.ativo && (
                <Badge variant="destructive" className="text-xs">
                  Inativo
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground truncate">
              {integrante.cargo_grau_texto || integrante.cargo_nome || 'Sem cargo'}
            </p>
            
            <p className="text-xs text-muted-foreground/70 truncate">
              {integrante.regional_texto}
            </p>
            
            {/* Flags especiais */}
            <div className="flex flex-wrap gap-1 mt-1">
              {integrante.caveira && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-500">
                  Caveira
                </Badge>
              )}
              {integrante.sgt_armas && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-500/50 text-red-500">
                  Sgt. Armas
                </Badge>
              )}
              {integrante.batedor && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/50 text-blue-500">
                  Batedor
                </Badge>
              )}
              {integrante.lobo && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-500/50 text-purple-500">
                  Lobo
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Ações */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => onEditar(integrante)}
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Ver/Editar
          </Button>
          
          {integrante.ativo && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => onInativar(integrante)}
            >
              <UserX className="h-3.5 w-3.5 mr-1.5" />
              Inativar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
