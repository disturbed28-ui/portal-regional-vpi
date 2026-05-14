import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCriteriosAvaliacao, type CriterioAvaliacao } from "@/hooks/useAvaliacaoData";
import { toast } from "sonner";

interface Props { regionalId: string | null; readOnly?: boolean; }

/**
 * Distribui o restante de 100% igualmente entre os critérios cujo peso NÃO foi
 * editado manualmente (peso_manual = false). Não altera os manuais.
 * Retorna mapa { id: novoPeso }. Apenas IDs alterados.
 */
function calcularPesosAutomaticos(criterios: CriterioAvaliacao[]): Record<string, number> {
  const ativos = criterios.filter(c => c.ativo);
  const manuais = ativos.filter(c => c.peso_manual);
  const auto = ativos.filter(c => !c.peso_manual);
  if (auto.length === 0) return {};
  const somaManuais = manuais.reduce((s, c) => s + Number(c.peso || 0), 0);
  const restante = Math.max(0, 100 - somaManuais);
  const pesoCada = Math.round((restante / auto.length) * 100) / 100;
  const updates: Record<string, number> = {};
  auto.forEach((c, idx) => {
    // Último recebe o ajuste para fechar exatamente o restante
    const valor = idx === auto.length - 1
      ? Math.round((restante - pesoCada * (auto.length - 1)) * 100) / 100
      : pesoCada;
    if (Number(c.peso || 0) !== valor) updates[c.id] = valor;
  });
  return updates;
}

export function CriteriosAvaliacaoTab({ regionalId, readOnly }: Props) {
  const { criterios, loading, refetch } = useCriteriosAvaliacao(regionalId, false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<CriterioAvaliacao | null>(null);
  const [pesoEdit, setPesoEdit] = useState<Record<string, string>>({});

  const totalPeso = useMemo(
    () => criterios.filter(c => c.ativo).reduce((s, c) => s + Number(c.peso || 0), 0),
    [criterios]
  );

  const aplicarAutoSugestao = async (criteriosBase: CriterioAvaliacao[]) => {
    const updates = calcularPesosAutomaticos(criteriosBase);
    const ids = Object.keys(updates);
    if (ids.length === 0) return;
    await Promise.all(ids.map(id =>
      supabase.from('criterios_avaliacao').update({ peso: updates[id] }).eq('id', id)
    ));
  };

  const criar = async () => {
    if (!nome.trim() || !regionalId) return;
    setSalvando(true);
    const { data, error } = await supabase.from('criterios_avaliacao').insert({
      regional_id: regionalId, nome: nome.trim(), descricao: descricao.trim() || null,
      ordem: criterios.length, peso: 0, peso_manual: false,
    }).select('*').single();
    if (error) {
      setSalvando(false);
      toast.error('Erro ao criar critério', { description: error.message, duration: 6000 });
      return;
    }
    // Recalcular automáticos incluindo o novo
    const novaLista = [...criterios, data as CriterioAvaliacao];
    await aplicarAutoSugestao(novaLista);
    setSalvando(false);
    toast.success('Critério criado', { duration: 6000 });
    setNome(""); setDescricao(""); refetch();
  };

  const toggleAtivo = async (c: CriterioAvaliacao, ativo: boolean) => {
    const { error } = await supabase.from('criterios_avaliacao').update({ ativo }).eq('id', c.id);
    if (error) { toast.error('Erro', { description: error.message, duration: 6000 }); return; }
    const novaLista = criterios.map(x => x.id === c.id ? { ...x, ativo } : x);
    await aplicarAutoSugestao(novaLista);
    refetch();
  };

  const salvarPeso = async (c: CriterioAvaliacao) => {
    const raw = pesoEdit[c.id];
    if (raw === undefined) return;
    const n = Number(raw.replace(',', '.'));
    if (isNaN(n) || n < 0 || n > 100) {
      toast.error('Peso inválido', { description: 'Valor entre 0 e 100', duration: 6000 });
      return;
    }
    const valor = Math.round(n * 100) / 100;
    // Validar que a soma dos manuais ativos (incluindo este) não passa de 100
    const somaManuaisOutros = criterios
      .filter(x => x.ativo && x.peso_manual && x.id !== c.id)
      .reduce((s, x) => s + Number(x.peso || 0), 0);
    if (somaManuaisOutros + valor > 100.001) {
      toast.error('Peso ultrapassa 100%', {
        description: `Outros pesos manuais somam ${Math.round(somaManuaisOutros * 100) / 100}%. Máximo permitido aqui: ${Math.round((100 - somaManuaisOutros) * 100) / 100}%.`,
        duration: 6000,
      });
      return;
    }
    const { error } = await supabase.from('criterios_avaliacao')
      .update({ peso: valor, peso_manual: true }).eq('id', c.id);
    if (error) { toast.error('Erro', { description: error.message, duration: 6000 }); return; }
    // Recalcular automáticos para fechar 100%
    const novaLista = criterios.map(x =>
      x.id === c.id ? { ...x, peso: valor, peso_manual: true } : x
    );
    await aplicarAutoSugestao(novaLista);
    setPesoEdit(s => { const n = { ...s }; delete n[c.id]; return n; });
    toast.success('Peso salvo e demais recalculados', { duration: 6000 });
    refetch();
  };

  const liberarAuto = async (c: CriterioAvaliacao) => {
    const { error } = await supabase.from('criterios_avaliacao')
      .update({ peso_manual: false }).eq('id', c.id);
    if (error) { toast.error('Erro', { description: error.message, duration: 6000 }); return; }
    const novaLista = criterios.map(x => x.id === c.id ? { ...x, peso_manual: false } : x);
    await aplicarAutoSugestao(novaLista);
    refetch();
  };

  const redistribuir = async () => {
    await aplicarAutoSugestao(criterios);
    toast.success('Pesos automáticos redistribuídos', { duration: 6000 });
    refetch();
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const { error } = await supabase.from('criterios_avaliacao').delete().eq('id', excluir.id);
    if (error) { toast.error('Erro ao excluir', { description: error.message, duration: 6000 }); return; }
    const novaLista = criterios.filter(c => c.id !== excluir.id);
    await aplicarAutoSugestao(novaLista);
    toast.success('Critério excluído', { duration: 6000 });
    setExcluir(null);
    refetch();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!regionalId) return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sem regional definida.</CardContent></Card>;

  const totalArred = Math.round(totalPeso * 100) / 100;
  const totalOk = Math.abs(totalArred - 100) < 0.01;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <Input placeholder="Nome do critério" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-[60px]" />
            <Button onClick={criar} disabled={!nome.trim() || salvando} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Adicionar critério
            </Button>
          </CardContent>
        </Card>
      )}

      {criterios.filter(c => c.ativo).length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-xs">
            Total ativo: <span className={`font-semibold ${totalOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{totalArred}%</span>
            {!totalOk && <span className="text-muted-foreground"> · ideal 100%</span>}
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={redistribuir} className="h-7 text-xs">
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Redistribuir automáticos
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {criterios.map(c => {
          const editandoPeso = pesoEdit[c.id] !== undefined;
          const valorInput = editandoPeso ? pesoEdit[c.id] : String(c.peso ?? 0);
          return (
            <Card key={c.id} className={!c.ativo ? 'opacity-60' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c.nome}</div>
                    {c.descricao && <div className="text-xs text-muted-foreground">{c.descricao}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{c.ativo ? 'Ativo' : 'Inativo'}</span>
                    <Switch checked={c.ativo} disabled={readOnly} onCheckedChange={(v) => toggleAtivo(c, v)} />
                    {!readOnly && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700"
                        onClick={() => setExcluir(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={100} step={0.01}
                      value={valorInput}
                      disabled={readOnly}
                      onChange={(e) => setPesoEdit(s => ({ ...s, [c.id]: e.target.value }))}
                      className="h-8 w-20 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  {editandoPeso && !readOnly && (
                    <>
                      <Button size="sm" className="h-8 text-xs" onClick={() => salvarPeso(c)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs"
                        onClick={() => setPesoEdit(s => { const n = { ...s }; delete n[c.id]; return n; })}>
                        Cancelar
                      </Button>
                    </>
                  )}
                  {c.peso_manual ? (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      Manual
                      {!readOnly && (
                        <button className="ml-1 underline text-muted-foreground hover:text-foreground"
                          onClick={() => liberarAuto(c)}>liberar</button>
                      )}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-muted/50">Automático</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {criterios.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum critério cadastrado.</CardContent></Card>}
      </div>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir critério?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluir?.nome}" será removido permanentemente. Avaliações já registradas com este critério deixarão de aparecer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-rose-600 hover:bg-rose-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
