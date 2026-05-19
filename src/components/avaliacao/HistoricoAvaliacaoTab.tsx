import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const periodo = periodos.find(p => p.id === periodoId);
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
      ) : (
        <div className="space-y-3">
          {linhas.map(l => (
            <Card key={l.integrante.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{l.integrante.nome_colete}</div>
                    <div className="text-[11px] text-muted-foreground">{l.divisao} · {l.integrante.cargo_grau_texto}</div>
                  </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
