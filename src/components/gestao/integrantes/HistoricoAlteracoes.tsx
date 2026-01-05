import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

export function HistoricoAlteracoes() {
  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Em desenvolvimento</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          O histórico de alterações estará disponível em breve. Todas as ações de edição e inativação já estão sendo registradas.
        </p>
      </CardContent>
    </Card>
  );
}
