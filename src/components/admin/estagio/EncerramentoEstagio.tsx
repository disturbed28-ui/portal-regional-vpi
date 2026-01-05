import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, Construction } from "lucide-react";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";

interface EncerramentoEstagioProps {
  userId: string | undefined;
  readOnly?: boolean;
}

export function EncerramentoEstagio({ userId, readOnly = false }: EncerramentoEstagioProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <XCircle className="h-5 w-5 text-primary" />
          Encerramento de Estágio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {readOnly && <ReadOnlyBanner />}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Em Construção</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Esta funcionalidade será implementada em breve.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
