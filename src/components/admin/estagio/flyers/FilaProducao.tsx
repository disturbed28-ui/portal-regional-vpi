import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";

interface FilaProducaoProps {
  readOnly?: boolean;
}

export function FilaProducao({ readOnly = false }: FilaProducaoProps) {
  const lookerUrl = "https://lookerstudio.google.com/embed/reporting/3fa2a59c-c1c2-4520-b231-d28e1db7a067/page/39jFF";

  return (
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}
      
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Fila de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full" style={{ minHeight: '600px' }}>
            <iframe
              src={lookerUrl}
              className="w-full h-full border-0 rounded-b-lg"
              style={{ minHeight: '600px', height: '80vh' }}
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="Fila de Produção - Looker Studio"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
