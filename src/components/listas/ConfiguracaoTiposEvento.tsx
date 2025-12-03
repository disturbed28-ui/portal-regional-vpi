import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GripVertical } from "lucide-react";
import { usePesosTiposEvento } from "@/hooks/usePesosTiposEvento";

interface ConfiguracaoTiposEventoProps {
  readOnly?: boolean;
}

export const ConfiguracaoTiposEvento = ({ readOnly = false }: ConfiguracaoTiposEventoProps) => {
  const { tiposEvento, isLoading, update } = usePesosTiposEvento();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Pesos - Tipos de Evento</CardTitle>
        <CardDescription>
          Defina a importância de cada tipo de evento (0% = pouco importante, 100% = muito importante)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {readOnly && (
          <Alert className="mb-4">
            <AlertDescription>
              Você está visualizando as configurações. Apenas Administradores e Diretores Regionais podem fazer alterações.
            </AlertDescription>
          </Alert>
        )}
        {tiposEvento.map((tipo) => (
          <div
            key={tipo.id}
            className="flex items-center gap-4 p-4 border rounded-lg"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tipo.tipo}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold" style={{ color: tipo.cor }}>
                    {(tipo.peso * 100).toFixed(0)}%
                  </span>
                  <Switch
                    checked={tipo.ativo}
                    onCheckedChange={(checked) => update({ id: tipo.id, updates: { ativo: checked } })}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[tipo.peso * 100]}
                  onValueChange={([value]) => {
                    update({ id: tipo.id, updates: { peso: value / 100 } });
                  }}
                  max={100}
                  step={5}
                  className="w-full"
                  disabled={readOnly}
                />
                <p className="text-xs text-muted-foreground">{tipo.descricao}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
