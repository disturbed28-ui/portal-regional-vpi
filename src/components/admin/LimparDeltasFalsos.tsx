import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const LimparDeltasFalsos = () => {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ count: number } | null>(null);

  const handlePreview = async () => {
    if (!dataInicio || !dataFim) {
      toast.error("Preencha as datas de início e fim");
      return;
    }

    try {
      setLoading(true);
      const { count, error } = await supabase
        .from('deltas_pendentes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDENTE')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim);

      if (error) throw error;

      setPreview({ count: count || 0 });
      toast.success(`${count || 0} deltas pendentes encontrados neste período`);
    } catch (error) {
      console.error('[LimparDeltasFalsos] Erro ao buscar preview:', error);
      toast.error('Erro ao buscar preview dos deltas');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = async () => {
    if (!dataInicio || !dataFim || !observacao.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!preview || preview.count === 0) {
      toast.error("Faça o preview primeiro para verificar quantos deltas serão afetados");
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja resolver ${preview.count} deltas como falsos?\n\nEsta ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('deltas_pendentes')
        .update({
          status: 'RESOLVIDO',
          observacao_admin: observacao,
          resolvido_por: 'admin',
          resolvido_em: new Date().toISOString()
        })
        .eq('status', 'PENDENTE')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim);

      if (error) throw error;

      toast.success(`${preview.count} deltas resolvidos com sucesso`);
      
      // Limpar formulário
      setDataInicio("");
      setDataFim("");
      setObservacao("");
      setPreview(null);
      
      // Limpar cache (todas as versões)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pendencias_')) {
          console.log('[LimparDeltasFalsos] Limpando cache:', key);
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[LimparDeltasFalsos] Erro ao limpar deltas:', error);
      toast.error('Erro ao limpar deltas falsos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Limpar Deltas Falsos
        </CardTitle>
        <CardDescription>
          Resolva em massa deltas pendentes criados por erros de importação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>ATENÇÃO:</strong> Esta função deve ser usada apenas para corrigir deltas criados por erros de sistema (como parse incorreto de IDs). 
            Sempre faça o preview antes de executar.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="data-inicio">Data/Hora Início</Label>
            <Input
              id="data-inicio"
              type="datetime-local"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="data-fim">Data/Hora Fim</Label>
            <Input
              id="data-fim"
              type="datetime-local"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacao">Observação *</Label>
            <Textarea
              id="observacao"
              placeholder="Explique por que estes deltas são falsos (ex: Erro de parse de id_integrante na importação)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={loading || !dataInicio || !dataFim}
              variant="outline"
              className="flex-1"
            >
              Preview
            </Button>
            <Button
              onClick={handleLimpar}
              disabled={loading || !preview || preview.count === 0 || !observacao.trim()}
              variant="destructive"
              className="flex-1"
            >
              {loading ? "Processando..." : `Resolver ${preview ? preview.count : 0} Deltas`}
            </Button>
          </div>

          {preview && (
            <Alert>
              <AlertDescription>
                <strong>{preview.count} deltas pendentes</strong> serão marcados como resolvidos no período selecionado.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
