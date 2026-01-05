import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Construction } from "lucide-react";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";

interface EstagioGrauVIProps {
  readOnly?: boolean;
}

export function EstagioGrauVI({ readOnly = false }: EstagioGrauVIProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Estágio Grau VI
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
