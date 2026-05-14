import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriodosAvaliacao, useAvaliacoesIntegrantes } from "@/hooks/useAvaliacaoData";
import { useIntegrantesGestao } from "@/hooks/useIntegrantesGestao";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props { userId: string | undefined; regionalId: string | null; readOnly?: boolean; }

export function PeriodosAvaliacaoTab({ userId, regionalId, readOnly }: Props) {
  const { periodos, loading, refetch } = usePeriodosAvaliacao(regionalId);
  const { integrantesPorDivisao } = useIntegrantesGestao(userId);
  const [criando, setCriando] = useState(false);

  const todos = useMemo(() => integrantesPorDivisao.flatMap(d => d.integrantes), [integrantesPorDivisao]);
  const [periodoVerificandoId, setPeriodoVerificandoId] = useState<string>("");
  const { avaliacoes } = useAvaliacoesIntegrantes(periodoVerificandoId, todos.map(i => i.id));

  const criarPeriodo = async () => {
    if (!regionalId) return;
    const ano = new Date().getFullYear();
    const sem = new Date().getMonth() < 6 ? 1 : 2;
    if (periodos.some(p => p.ano === ano && p.semestre === sem)) {
      toast.error('Já existe período para o semestre atual', { duration: 6000 }); return;
    }
    setCriando(true);
    const dataInicio = new Date(ano, sem === 1 ? 0 : 6, 1).toISOString().slice(0, 10);
    const dataFim = new Date(ano, sem === 1 ? 5 : 11, sem === 1 ? 30 : 31).toISOString().slice(0, 10);
    const { error } = await supabase.from('avaliacao_periodos').insert({
      regional_id: regionalId, nome: `${ano}/${sem}º Semestre`, ano, semestre: sem,
      status: 'aberto', data_inicio: dataInicio, data_fim: dataFim, criado_por: userId,
    });
    setCriando(false);
    if (error) toast.error('Erro', { description: error.message, duration: 6000 });
    else { toast.success('Período criado', { duration: 6000 }); refetch(); }
  };

  const encerrar = async (periodoId: string) => {
    setPeriodoVerificandoId(periodoId);
    // Aguardar render para usar avaliacoes; pequeno delay
    setTimeout(async () => {
      const integrantesAvaliados = new Set(avaliacoes.filter(a => a.periodo_id === periodoId).map(a => a.integrante_id));
      const pendentes = todos.filter(i => !integrantesAvaliados.has(i.id));
      if (pendentes.length > 0) {
        toast.error(`Existem ${pendentes.length} integrante(s) sem avaliação`, {
          description: 'Conclua todas as avaliações antes de encerrar.', duration: 6000,
        });
        return;
      }
      const { error } = await supabase.from('avaliacao_periodos').update({
        status: 'encerrado', encerrado_em: new Date().toISOString(), encerrado_por: userId,
      }).eq('id', periodoId);
      if (error) toast.error('Erro', { description: error.message, duration: 6000 });
      else { toast.success('Período encerrado', { duration: 6000 }); refetch(); }
    }, 500);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Button onClick={criarPeriodo} disabled={criando}>
          <Plus className="h-4 w-4 mr-1" /> Criar período do semestre atual
        </Button>
      )}
      <div className="space-y-2">
        {periodos.map(p => {
          const avalsDoPeriodo = avaliacoes.filter(a => a.periodo_id === p.id);
          const avaliados = new Set(avalsDoPeriodo.map(a => a.integrante_id)).size;
          return (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.nome}</span>
                    <Badge variant={p.status === 'aberto' ? 'default' : 'secondary'}>{p.status}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(p.data_inicio), 'dd/MM/yy')} – {format(new Date(p.data_fim), 'dd/MM/yy')}
                    {periodoVerificandoId === p.id && ` · ${avaliados}/${todos.length} avaliados`}
                  </div>
                </div>
                {p.status === 'aberto' && !readOnly && (
                  <Button size="sm" variant="outline" onClick={() => encerrar(p.id)}>
                    <Lock className="h-3.5 w-3.5 mr-1" /> Encerrar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {periodos.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum período cadastrado.</CardContent></Card>}
      </div>
    </div>
  );
}
