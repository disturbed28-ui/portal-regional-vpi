import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator, GripVertical, Plus, Save } from "lucide-react";
import { usePesosJustificativas } from "@/hooks/usePesosJustificativas";
import { Badge } from "@/components/ui/badge";

interface ConfiguracaoJustificativasProps {
  readOnly?: boolean;
}

export const ConfiguracaoJustificativas = ({ readOnly = false }: ConfiguracaoJustificativasProps) => {
  const { justificativas, isLoading, update } = usePesosJustificativas();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState({
    totalEventos: 10,
    presente: 7,
    saude: 1,
    trabalho: 1,
    familia: 1,
    naoJustificou: 0,
  });

  const calcularSimulacao = () => {
    const justificativasAtivas = justificativas.filter(j => j.ativo);
    const presentePeso = justificativasAtivas.find(j => j.tipo === 'Presente')?.peso || 1;
    const saudePeso = justificativasAtivas.find(j => j.tipo === 'Saúde')?.peso || 0.75;
    const trabalhoPeso = justificativasAtivas.find(j => j.tipo === 'Trabalho')?.peso || 0.5;
    const familiaPeso = justificativasAtivas.find(j => j.tipo === 'Família')?.peso || 0.4;
    const naoJustPeso = justificativasAtivas.find(j => j.tipo === 'Não justificou')?.peso || 0.001;

    const pontosObtidos = 
      (simulacao.presente * presentePeso) +
      (simulacao.saude * saudePeso) +
      (simulacao.trabalho * trabalhoPeso) +
      (simulacao.familia * familiaPeso) +
      (simulacao.naoJustificou * naoJustPeso);

    const pontosMaximos = simulacao.totalEventos;
    const percentual = pontosMaximos > 0 ? (pontosObtidos / pontosMaximos) * 100 : 0;

    return { pontosObtidos, pontosMaximos, percentual };
  };

  const resultado = calcularSimulacao();

  const getCorAproveitamento = (percentual: number) => {
    if (percentual >= 85) return 'bg-green-500';
    if (percentual >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Pesos - Justificativas</CardTitle>
          <CardDescription>
            Defina o peso de cada tipo de justificativa (0% = não vale nada, 100% = vale totalmente)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {readOnly && (
            <Alert className="mb-4">
              <AlertDescription>
                Você está visualizando as configurações. Apenas administradores podem fazer alterações.
              </AlertDescription>
            </Alert>
          )}
          {justificativas.map((just) => (
            <div
              key={just.id}
              className="flex items-center gap-4 p-4 border rounded-lg"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{just.tipo}</span>
                    {just.bloqueado && (
                      <Badge variant="outline" className="text-xs">Bloqueado</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold" style={{ color: just.cor }}>
                      {(just.peso * 100).toFixed(0)}%
                    </span>
                    <Switch
                      checked={just.ativo}
                      onCheckedChange={(checked) => update({ id: just.id, updates: { ativo: checked } })}
                      disabled={readOnly || just.bloqueado}
                    />
                  </div>
                </div>

                {!just.bloqueado && (
                  <div className="space-y-2">
                    <Slider
                      value={[just.peso * 100]}
                      onValueChange={([value]) => {
                        update({ id: just.id, updates: { peso: value / 100 } });
                      }}
                      max={100}
                      step={1}
                      className="w-full"
                      disabled={readOnly}
                    />
                    <p className="text-xs text-muted-foreground">{just.descricao}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Aproveitamento
          </CardTitle>
          <CardDescription>
            Teste como diferentes cenários afetam o aproveitamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Total de Eventos no Período</Label>
            <Input
              type="number"
              min={1}
              value={simulacao.totalEventos}
              onChange={(e) => setSimulacao(prev => ({ ...prev, totalEventos: parseInt(e.target.value) || 0 }))}
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Presente</Label>
              <Input
                type="number"
                min={0}
                max={simulacao.totalEventos}
                value={simulacao.presente}
                onChange={(e) => setSimulacao(prev => ({ ...prev, presente: parseInt(e.target.value) || 0 }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Saúde</Label>
              <Input
                type="number"
                min={0}
                max={simulacao.totalEventos}
                value={simulacao.saude}
                onChange={(e) => setSimulacao(prev => ({ ...prev, saude: parseInt(e.target.value) || 0 }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Trabalho</Label>
              <Input
                type="number"
                min={0}
                max={simulacao.totalEventos}
                value={simulacao.trabalho}
                onChange={(e) => setSimulacao(prev => ({ ...prev, trabalho: parseInt(e.target.value) || 0 }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Família</Label>
              <Input
                type="number"
                min={0}
                max={simulacao.totalEventos}
                value={simulacao.familia}
                onChange={(e) => setSimulacao(prev => ({ ...prev, familia: parseInt(e.target.value) || 0 }))}
                disabled={readOnly}
              />
            </div>
          </div>

          <Alert>
            <AlertTitle className="text-xl font-bold flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full ${getCorAproveitamento(resultado.percentual)}`} />
              {resultado.percentual.toFixed(1)}%
            </AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                <div>Pontos obtidos: {resultado.pontosObtidos.toFixed(2)}</div>
                <div>Pontos máximos: {resultado.pontosMaximos.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {resultado.percentual >= 85 && '🟢 Excelente aproveitamento'}
                  {resultado.percentual >= 50 && resultado.percentual < 85 && '🟡 Aproveitamento regular'}
                  {resultado.percentual < 50 && '🔴 Aproveitamento baixo'}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};
