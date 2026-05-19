import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Download, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrantesGestao } from "@/hooks/useIntegrantesGestao";
import { useUserRole } from "@/hooks/useUserRole";
import {
  usePeriodosAvaliacao,
  useCriteriosAvaliacao,
  useAvaliacoesIntegrantes,
  useDecisoesAvaliacao,
} from "@/hooks/useAvaliacaoData";
import { toast } from "sonner";

interface Props {
  userId: string | undefined;
  regionalId: string | null;
}

export function HistoricoAvaliacaoTab({ userId, regionalId }: Props) {
  const { integrantesPorDivisao, loading: loadingInt } = useIntegrantesGestao(userId);
  const { periodos, loading: loadingPer } = usePeriodosAvaliacao(regionalId);
  const { criterios, loading: loadingCrit } = useCriteriosAvaliacao(regionalId, false);
  const { hasRole } = useUserRole(userId);

  const [periodoId, setPeriodoId] = useState<string>("");
  const [divisaoFiltro, setDivisaoFiltro] = useState<string>("");

  const todos = useMemo(() => integrantesPorDivisao.flatMap(d => d.integrantes), [integrantesPorDivisao]);
  const { avaliacoes } = useAvaliacoesIntegrantes(periodoId, todos.map(i => i.id));
  const { decisoesMap, refetch: refetchDecisoes } = useDecisoesAvaliacao(periodoId, todos.map(i => i.id));

  const podeReabrir = hasRole('admin') || hasRole('comando') || hasRole('diretor_regional');
  const periodoSelecionado = periodos.find(p => p.id === periodoId);
  const periodoAberto = periodoSelecionado?.status === 'aberto';

  const periodo = periodoSelecionado;

  const handleReabrir = async (integranteId: string, integranteNome: string) => {
    if (!periodoId) return;
    if (!confirm(`Reabrir a avaliação de ${integranteNome}? A decisão Regional será removida e a avaliação voltará a aparecer como pendente.`)) return;
    const { error } = await supabase
      .from('avaliacoes_decisao_final' as any)
      .delete()
      .eq('periodo_id', periodoId)
      .eq('integrante_id', integranteId)
      .eq('etapa', 'regional');
    if (error) {
      toast.error('Erro ao reabrir avaliação', { description: error.message, duration: 6000 });
      return;
    }
    toast.success(`Avaliação de ${integranteNome} reaberta`, { duration: 6000 });
    refetchDecisoes();
  };
  const divisoes = useMemo(
    () => Array.from(new Set(integrantesPorDivisao.map(d => d.divisaoNome))).sort(),
    [integrantesPorDivisao]
  );

  const linhas = useMemo(() => {
    return integrantesPorDivisao
      .filter(g => !divisaoFiltro || g.divisaoNome === divisaoFiltro)
      .flatMap(g => g.integrantes.map(int => {
        const respostas: Record<string, { status: string; obs: string }> = {};
        criterios.forEach(c => {
          const a = avaliacoes.find(av => av.integrante_id === int.id && av.criterio_id === c.id);
          respostas[c.id] = { status: a?.status ?? '-', obs: a?.observacao ?? '' };
        });
        return { divisao: g.divisaoNome, integrante: int, respostas };
      }));
  }, [integrantesPorDivisao, divisaoFiltro, criterios, avaliacoes]);

  const handleExport = async () => {
    if (!periodo) { toast.error('Selecione um período'); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Avaliações');
    const headers = ['Divisão', 'Nome de Colete', 'Cargo/Grau', ...criterios.map(c => c.nome), 'Observações'];
    ws.addRow(headers);
    ws.getRow(1).eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
      c.font = { bold: true, color: { argb: 'FF1F4E78' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    });
    linhas.forEach(l => {
      const obsConcat = criterios
        .map(c => l.respostas[c.id].obs ? `${c.nome}: ${l.respostas[c.id].obs}` : null)
        .filter(Boolean).join(' | ');
      const row = ws.addRow([
        l.divisao,
        l.integrante.nome_colete,
        l.integrante.cargo_grau_texto,
        ...criterios.map(c => l.respostas[c.id].status === 'sim' ? 'Sim' : l.respostas[c.id].status === 'nao' ? 'Não' : '-'),
        obsConcat,
      ]);
      row.eachCell((c, idx) => {
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        c.alignment = { vertical: 'middle', wrapText: idx > 1 };
        if (idx >= 4 && idx <= 3 + criterios.length) {
          const v = String(c.value || '');
          if (v === 'Sim') {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            c.font = { color: { argb: 'FF006100' }, bold: true };
          } else if (v === 'Não') {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
            c.font = { color: { argb: 'FF9C0006' }, bold: true };
          }
        }
      });
    });
    ws.columns.forEach((col, i) => { col.width = i === 0 ? 28 : i === 1 ? 22 : i <= 2 ? 24 : 14; });
    ws.getColumn(headers.length).width = 50;

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacao-${periodo.nome.replace(/\s+/g, '-')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingInt || loadingPer || loadingCrit) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <Select value={periodoId} onValueChange={setPeriodoId}>
            <SelectTrigger className="sm:w-64"><SelectValue placeholder="Selecione um período" /></SelectTrigger>
            <SelectContent>
              {periodos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={divisaoFiltro || 'all'} onValueChange={(v) => setDivisaoFiltro(v === 'all' ? '' : v)}>
            <SelectTrigger className="sm:w-64"><SelectValue placeholder="Todas as divisões" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as divisões</SelectItem>
              {divisoes.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={!periodoId} className="sm:ml-auto">
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
        </CardContent>
      </Card>

      {!periodoId ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Selecione um período para visualizar.</CardContent></Card>
      ) : (() => {
        const linhasConcluidas = linhas.filter(l => !!(decisoesMap[l.integrante.id]?.regional));
        if (linhasConcluidas.length === 0) {
          return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação concluída pelo Diretor Regional neste período.</CardContent></Card>;
        }
        const porDivisao = linhasConcluidas.reduce<Record<string, typeof linhasConcluidas>>((acc, l) => {
          (acc[l.divisao] ||= []).push(l);
          return acc;
        }, {});
        const divisoesOrdenadas = Object.keys(porDivisao).sort();
        return (
          <Accordion type="multiple" className="space-y-2">
            {divisoesOrdenadas.map(div => {
              const itens = porDivisao[div];
              const aprov = itens.filter(i => decisoesMap[i.integrante.id]?.regional?.decisao === 'aprovado').length;
              const repr = itens.length - aprov;
              return (
                <AccordionItem key={div} value={div} className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline">
                    <div className="flex items-center gap-2 flex-wrap text-left">
                      <span className="font-semibold text-sm">{div}</span>
                      <Badge variant="outline" className="text-[10px]">{itens.length}</Badge>
                      {aprov > 0 && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">{aprov} aprov.</Badge>}
                      {repr > 0 && <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600 text-white">{repr} repr.</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="space-y-2">
                      {itens.map(l => {
                        const decDR = decisoesMap[l.integrante.id]!.regional!;
                        return (
                          <Card key={l.integrante.id}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="min-w-0">
                                  <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                    <span className="truncate">{l.integrante.nome_colete}</span>
                                    {decDR.decisao === 'aprovado'
                                      ? <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white gap-1"><ShieldCheck className="h-3 w-3" />Aprovado</Badge>
                                      : <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600 text-white gap-1"><ShieldX className="h-3 w-3" />Reprovado</Badge>}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{l.integrante.cargo_grau_texto}</div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    Por <span className="font-medium text-foreground">{decDR.decidido_por_nome || '—'}</span>
                                    {' · '}{format(new Date(decDR.decidido_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                                  </div>
                                  {decDR.justificativa && (
                                    <div className="text-[11px] bg-muted/50 rounded p-1.5 italic mt-1">"{decDR.justificativa}"</div>
                                  )}
                                </div>
                                {podeReabrir && periodoAberto && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleReabrir(l.integrante.id, l.integrante.nome_colete)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 mr-1" />Reabrir
                                  </Button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {criterios.map(c => {
                                  const r = l.respostas[c.id];
                                  const cor = r.status === 'sim' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                                    : r.status === 'nao' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                                    : 'bg-muted text-muted-foreground border-border';
                                  return (
                                    <span key={c.id} className={`text-[11px] px-2 py-0.5 rounded border ${cor}`} title={r.obs}>
                                      {c.nome}: {r.status === 'sim' ? 'Sim' : r.status === 'nao' ? 'Não' : '—'}
                                    </span>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        );
      })()}
    </div>
  );
}

