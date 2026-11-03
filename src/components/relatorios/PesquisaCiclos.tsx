import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Eye, FileText, LockKeyhole, Loader2, RefreshCw } from 'lucide-react';
import type { SnapshotCiclo } from '../../../supabase/functions/_shared/pesquisaCiclos';
type Ciclo = { id: string; nome: string; inicio: string; fim: string; fechado_em: string; respostas: number; satisfacao: number | null; delta: number | null; versao: number; versoes: { versao: number; motivo: string | null; criadoEm: string }[] };
type Previa = { snapshot: SnapshotCiclo; hash: string; pendente: boolean; sobreposto: boolean };
const fmt = (n: number | null | undefined) => n == null ? '—' : n.toFixed(1).replace('.', ',');
const data = (s: string) => new Date(s).toLocaleString('pt-BR');
function arquivo(pdf: string, nome: string, abrir = false) {
  const bytes = Uint8Array.from(atob(pdf), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  if (abrir) window.open(url, '_blank', 'noopener,noreferrer');
  else { const a = document.createElement('a'); a.href = url; a.download = `${nome.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`; a.click(); }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function PesquisaCiclos({ regionalId, divisaoId, inicio, fim }: { regionalId: string; divisaoId: string | null; inicio: string; fim: string }) {
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false), [nome, setNome] = useState('');
  const [de, setDe] = useState(inicio), [ate, setAte] = useState(fim), [confirmar, setConfirmar] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null), [revisar, setRevisar] = useState<Ciclo | null>(null), [motivo, setMotivo] = useState('');
  const [visual, setVisual] = useState<{ snapshot: SnapshotCiclo; pdf: string; nome: string; versao: number } | null>(null);
  const [versoes, setVersoes] = useState<Record<string, number>>({});
  const chamar = async (acao: string, extra: Record<string, unknown> = {}) => {
    const { data: d, error } = await supabase.functions.invoke('pesquisa-ciclos', { body: { acao, regionalId, divisaoId, inicio, fim, ...extra } });
    if (error) { const det = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null; throw new Error(det?.error || 'Não foi possível concluir a solicitação.'); }
    return d;
  };
  const q = useQuery<{ ciclos: Ciclo[]; podeFechar: boolean }>({ queryKey: ['pesquisa-ciclos', regionalId, divisaoId], queryFn: () => chamar('historico'), staleTime: 60000 });
  const executar = async (fn: () => Promise<void>) => { setErro(''); setOcupado(true); try { await fn(); } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao gerar relatório.'); } finally { setOcupado(false); } };
  const abrirFechamento = (c: Ciclo | null = null) => {
    setRevisar(c); setNome(c?.nome || ''); setDe(c?.inicio || inicio); setAte(c?.fim || fim); setMotivo(''); setConfirmar(false); setPrevia(null); setErro(''); setAberto(true);
  };
  const carregarPrevia = () => executar(async () => { setConfirmar(false); setPrevia(await chamar('previa', { inicio: de, fim: ate, divisaoId: null, ...(revisar ? { cicloId: revisar.id } : {}) })); });
  const fechar = () => executar(async () => {
    if (!previa) return;
    await chamar('fechar', { inicio: de, fim: ate, divisaoId: null, nome, confirmar, hash: previa.hash, ...(revisar ? { cicloId: revisar.id, motivo } : {}) });
    setAberto(false); await q.refetch();
  });
  return <section className="space-y-3 border-t border-border pt-3">
    <div className="flex flex-col sm:flex-row gap-2">
      <Button disabled={ocupado} onClick={() => executar(async () => { const d = await chamar('gerencial'); arquivo(d.pdf, `Pesquisa_Gerencial_${inicio}_${fim}`); })} className="whitespace-normal h-auto min-h-10"><FileText />Gerar Relatório Gerencial</Button>
      {q.data?.podeFechar && <Button variant="outline" disabled={ocupado} onClick={() => abrirFechamento()} className="whitespace-normal h-auto min-h-10"><LockKeyhole />Fechar Ciclo de Avaliação</Button>}
      {ocupado && <Loader2 className="h-5 w-5 animate-spin self-center" />}
    </div>
    {!aberto && erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {q.error && <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>}
    <h3 className="font-semibold text-sm">Histórico de Ciclos</h3>
    {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
    {q.data?.ciclos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ciclo fechado nesta regional.</p>}
    <div className="space-y-2">{q.data?.ciclos.map(c => <article key={c.id} className="border border-border rounded-md p-3 space-y-2">
      <div className="flex flex-wrap gap-2 justify-between"><h4 className="font-semibold break-words min-w-0">{c.nome}</h4><span className="text-xs text-muted-foreground">Versão {c.versao}</span></div>
      <p className="text-xs text-muted-foreground">{c.inicio} a {c.fim} · Fechado em {data(c.fechado_em)}</p>
      <p className="text-sm">{c.respostas} respostas · Satisfação {fmt(c.satisfacao)}/5{c.delta != null && <> · Variação {fmt(c.delta)} pontos</>}</p>
      {c.versoes.length > 1 && <Select value={String(versoes[c.id] || c.versao)} onValueChange={v => setVersoes(s => ({ ...s, [c.id]: Number(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{c.versoes.map(v => <SelectItem key={v.versao} value={String(v.versao)}>Versão {v.versao} · {v.motivo || 'Original'}</SelectItem>)}</SelectContent></Select>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar(async () => setVisual(await chamar('visualizar', { cicloId: c.id, versao: versoes[c.id] || c.versao })))}><Eye />Visualizar</Button>
        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar(async () => { const d = await chamar('visualizar', { cicloId: c.id, versao: versoes[c.id] || c.versao }); arquivo(d.pdf, `${c.nome}_v${d.versao}`); })}><Download />PDF</Button>
        {q.data?.podeFechar && <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => abrirFechamento(c)}><RefreshCw />Revisar</Button>}
      </div>
    </article>)}</div>
    <Dialog open={aberto} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="w-[98vw] max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{revisar ? 'Revisar Ciclo de Avaliação' : 'Fechar Ciclo de Avaliação'}</DialogTitle><DialogDescription>{regionalId && 'Consolidado regional · O formulário público continuará recebendo respostas.'}</DialogDescription></DialogHeader>
      <div className="space-y-1"><Label htmlFor="ciclo-nome">Nome do ciclo</Label><Input id="ciclo-nome" value={nome} maxLength={120} onChange={e => setNome(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor="ciclo-inicio">Mês inicial</Label><Input id="ciclo-inicio" type="month" value={de} disabled={!!revisar} onChange={e => { setDe(e.target.value); setPrevia(null); }} /></div><div className="space-y-1"><Label htmlFor="ciclo-fim">Mês final</Label><Input id="ciclo-fim" type="month" value={ate} disabled={!!revisar} onChange={e => { setAte(e.target.value); setPrevia(null); }} /></div></div>
      {revisar && <div className="space-y-1"><Label htmlFor="ciclo-motivo">Motivo da revisão</Label><Input id="ciclo-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>}
      <Button variant="outline" disabled={ocupado || !de || !ate || de > ate} onClick={carregarPrevia}><RefreshCw />{ocupado ? 'Consultando…' : 'Conferir prévia atualizada'}</Button>
      {previa && <><Resumo d={previa.snapshot} /><p className="text-xs text-muted-foreground">{previa.snapshot.divisoes?.length || 0} divisões · {de} a {ate}</p>{previa.pendente && <p className="text-sm text-warning">Análises em atualização. Aguarde e confira a prévia novamente.</p>}{previa.sobreposto && <p role="alert" className="text-sm text-destructive">Existe um ciclo oficial com período sobreposto.</p>}
        <div className="flex gap-2 items-start"><Checkbox id="ciclo-confirmar" checked={confirmar} onCheckedChange={v => setConfirmar(v === true)} /><Label htmlFor="ciclo-confirmar" className="leading-normal">Confirmo o fechamento oficial dos resultados desta prévia.</Label></div></>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button disabled={ocupado || !nome.trim() || !confirmar || !previa || previa.pendente || previa.sobreposto || (!!revisar && motivo.trim().length < 5)} onClick={fechar}><LockKeyhole />{revisar ? 'Confirmar revisão' : 'Confirmar fechamento'}</Button>
    </DialogContent></Dialog>
    <Dialog open={!!visual} onOpenChange={v => { if (!v) setVisual(null); }}><DialogContent className="w-[98vw] max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{visual?.nome} · Versão {visual?.versao}</DialogTitle><DialogDescription>Relatório oficial · {visual?.snapshot.periodo.inicio} a {visual?.snapshot.periodo.fim}</DialogDescription></DialogHeader>{visual && <><Resumo d={visual.snapshot} />{visual.snapshot.analise?.diagnostico && <p className="text-sm">{visual.snapshot.analise.diagnostico}</p>}{visual.snapshot.comparacao && <p className="text-xs text-muted-foreground">{visual.snapshot.comparacao.ressalva}</p>}<div className="flex flex-wrap gap-2"><Button onClick={() => arquivo(visual.pdf, `${visual.nome}_v${visual.versao}`)}><Download />Baixar PDF</Button><Button variant="outline" onClick={() => arquivo(visual.pdf, visual.nome, true)}><Eye />Abrir relatório completo</Button></div></>}</DialogContent></Dialog>
  </section>;
}
function Resumo({ d }: { d: SnapshotCiclo }) {
  return <div className="space-y-2 border-y border-border py-3"><p className="text-sm font-semibold">{d.indicadores.respostas} respostas de {d.indicadores.participacao?.integrantesAtivos ?? '—'} integrantes de referência · {fmt(d.indicadores.participacao?.percentual)}%</p><div className="grid grid-cols-2 gap-2">{d.indicadores.medias.map(m => <div key={m.chave}><p className="text-xs text-muted-foreground">{m.rotulo}</p><p className="font-semibold">{fmt(m.media)} /5</p></div>)}</div></div>;
}