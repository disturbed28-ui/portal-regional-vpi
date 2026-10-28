import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, Info, Sparkles } from 'lucide-react';

type Tema = { tema: string; resumo: string; respostas: number; divisoes: number; comentarios: string[] };
type Analise = {
  estado: 'ok' | 'desatualizada' | 'processando' | 'erro' | 'amostra_insuficiente' | 'sem_respostas';
  minimo?: number; geradoEm?: string; erro?: string | null; diagnostico?: string; recomendacoes?: string[];
  pontosFortes?: Tema[]; pontosFracos?: Tema[]; sugestoes?: Tema[]; boasPraticas?: Tema[];
  respostasIncluidas?: number; divisoesIncluidas?: number;
};
type Ind = {
  respostas: number; respondentesAtividades: number;
  participacao?: { integrantesAtivos: number; percentual: number | null; metaAtingida: boolean };
  medias: { chave: string; rotulo: string; media: number | null; avaliacoes: number }[];
  atividades: { codigo: string; rotulo: string; quantidade: number; percentual: number }[];
  programacaoAdequada: { quantidade: number; percentual: number };
};
type Resp = {
  error?: string; selecioneRegional?: boolean; minimo?: number; outros?: string[];
  escopo: { nivel: 'comando' | 'regional' | 'divisao'; regionalId: string | null; divisaoId: string | null;
    regionais: { id: string; nome: string }[]; divisoes: { id: string; nome: string }[] };
  indicadores?: Ind; analise?: Analise;
  divisoes?: { divisaoId: string; nome: string; indicadores: Ind; analise: Analise }[];
};

const mesAtual = format(new Date(), 'yyyy-MM');
const meses = Array.from({ length: 18 }, (_, i) => format(subMonths(new Date(), i), 'yyyy-MM'));
const rotuloMes = (m: string) => format(new Date(`${m}-01T12:00:00`), 'MMM/yyyy', { locale: ptBR });
const nomeCurto = (n: string) => n.replace(/^DIVISAO\s+/i, '').replace(/\s*-\s*SP$/i, '');
const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1).replace('.', ','));

export function PesquisaSatisfacaoTab() {
  const [modo, setModo] = useState<'atual' | 'mes' | 'intervalo'>('atual');
  const [mes, setMes] = useState(mesAtual);
  const [inicio, setInicio] = useState(meses[2]);
  const [fim, setFim] = useState(mesAtual);
  const [regionalId, setRegionalId] = useState<string | null>(null);
  const [divisaoId, setDivisaoId] = useState<string | null>(null);
  const periodo = modo === 'atual' ? { inicio: mesAtual, fim: mesAtual } : modo === 'mes' ? { inicio: mes, fim: mes }
    : { inicio: inicio <= fim ? inicio : fim, fim: inicio <= fim ? fim : inicio };

  const q = useQuery({
    queryKey: ['pesquisa-relatorio', regionalId, divisaoId, periodo.inicio, periodo.fim],
    queryFn: async (): Promise<Resp> => {
      const { data, error } = await supabase.functions.invoke('pesquisa-satisfacao-relatorio', {
        body: { regionalId, divisaoId, ...periodo },
      });
      if (error) {
        const det = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        throw new Error(det?.error || 'Não foi possível carregar o relatório.');
      }
      return data;
    },
    // While an analysis is being (re)generated in the background, poll the cached result.
    refetchInterval: (query) => {
      const d = query.state.data as Resp | undefined;
      const pend = [d?.analise, ...(d?.divisoes || []).map(x => x.analise)].some(a => a?.estado === 'processando' || a?.estado === 'desatualizada');
      return pend ? 20000 : false;
    },
    staleTime: 60000,
  });
  const escopo = q.data?.escopo;
  useEffect(() => {
    if (!escopo) return;
    if (escopo.regionalId && escopo.regionalId !== regionalId) setRegionalId(escopo.regionalId);
    if (escopo.nivel === 'divisao' && escopo.divisaoId !== divisaoId) setDivisaoId(escopo.divisaoId);
  }, [escopo]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = q.data;
  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden">
      <Card>
        <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="atual">Mês atual</SelectItem>
              <SelectItem value="mes">Mês específico</SelectItem>
              <SelectItem value="intervalo">Intervalo de meses</SelectItem>
            </SelectContent>
          </Select>
          {modo === 'mes' && <MesSelect value={mes} onChange={setMes} />}
          {modo === 'intervalo' && (
            <div className="grid grid-cols-2 gap-2"><MesSelect value={inicio} onChange={setInicio} /><MesSelect value={fim} onChange={setFim} /></div>
          )}
          <Select value={regionalId ?? ''} onValueChange={(v) => { setRegionalId(v); setDivisaoId(null); }} disabled={!escopo || escopo.nivel !== 'comando'}>
            <SelectTrigger><SelectValue placeholder="Selecione a regional" /></SelectTrigger>
            <SelectContent>{escopo?.regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={divisaoId ?? 'todas'} onValueChange={(v) => setDivisaoId(v === 'todas' ? null : v)} disabled={!regionalId || escopo?.nivel === 'divisao'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {escopo?.nivel !== 'divisao' && <SelectItem value="todas">Todas as divisões</SelectItem>}
              {escopo?.divisoes.map(v => <SelectItem key={v.id} value={v.id}>{nomeCurto(v.nome)}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {q.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {q.error && <Aviso texto={(q.error as Error).message} />}
      {d?.selecioneRegional && <Aviso texto="Selecione uma regional para ver os resultados." />}
      {d?.indicadores && (
        <>
          <Indicadores ind={d.indicadores} />
          {d.indicadores.respostas > 0 && <Atividades ind={d.indicadores} outros={d.outros || []} />}
          {d.indicadores.respostas > 0 && (
            d.analise && <BlocoAnalise titulo={divisaoId ? 'Análise da divisão' : 'Diagnóstico consolidado da regional'} a={d.analise} regional={!divisaoId} />
          )}
          {!divisaoId && (d.divisoes?.length || 0) > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Divisão por divisão</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1 space-y-2">
                {d.divisoes?.map(v => <DivisaoItem key={v.divisaoId} v={v} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{meses.map(m => <SelectItem key={m} value={m}>{rotuloMes(m)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const Aviso = ({ texto }: { texto: string }) => (
  <div className="flex gap-2 items-start rounded-md border border-border bg-muted/40 p-3 text-xs sm:text-sm text-muted-foreground">
    <Info className="h-4 w-4 mt-0.5 shrink-0" /><span>{texto}</span>
  </div>
);

function Indicadores({ ind }: { ind: Ind }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
      <Card className="col-span-2 lg:col-span-1"><CardContent className="p-3">
        <p className="text-xs text-muted-foreground">Respostas válidas</p>
        <p className={`text-2xl font-bold break-words ${corParticipacao(ind)}`}>
          {ind.respostas}{ind.participacao && <> de {ind.participacao.integrantesAtivos}</>}
        </p>
        {ind.participacao && <>
          <p className={`text-xs font-bold ${corParticipacao(ind)}`}>
            {ind.participacao.percentual === null ? 'Sem efetivo ativo' : `${fmt(ind.participacao.percentual)}% · Meta 80%`}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1" title="Pesquisa anônima: quantidade de respostas, não pessoas únicas identificadas.">Respostas no período / integrantes ativos hoje</p>
        </>}
      </CardContent></Card>
      {ind.medias.map((m, i) => (
        <Card key={m.chave} className={i === 0 ? 'border-primary/60' : ''}><CardContent className="p-3">
          <p className="text-xs text-muted-foreground leading-tight">{m.rotulo}</p>
          <p className="text-2xl font-bold">{fmt(m.media)}<span className="text-xs font-normal text-muted-foreground"> /5</span></p>
          <p className="text-[11px] text-muted-foreground">{m.avaliacoes} avaliações</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

function corParticipacao(ind: Ind) {
  if (!ind.participacao || ind.participacao.percentual === null) return 'text-muted-foreground';
  return ind.participacao.metaAtingida ? 'text-success' : 'text-warning';
}

function Atividades({ ind, outros }: { ind: Ind; outros: string[] }) {
  const max = Math.max(1, ...ind.atividades.map(a => a.quantidade));
  return (
    <Card>
      <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Atividades que precisam ser ampliadas</CardTitle></CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        <p className="text-[11px] text-muted-foreground">{ind.respondentesAtividades} responderam. Cada um pode marcar até duas opções; os percentuais podem somar mais de 100%.</p>
        {ind.atividades.map(a => (
          <div key={a.codigo} className="space-y-0.5">
            <div className="flex justify-between gap-2 text-xs"><span className="min-w-0 break-words">{a.rotulo}</span><span className="shrink-0 font-medium">{a.quantidade} · {a.percentual.toString().replace('.', ',')}%</span></div>
            <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(a.quantidade / max) * 100}%` }} /></div>
          </div>
        ))}
        <div className="rounded-md bg-muted/40 p-2 text-xs">Programação atual adequada (“Nenhuma”): <b>{ind.programacaoAdequada.quantidade}</b> · {ind.programacaoAdequada.percentual.toString().replace('.', ',')}%</div>
        {outros.length > 0 && <p className="text-[11px] text-muted-foreground break-words">“Outros”: {outros.join(' · ')}</p>}
      </CardContent>
    </Card>
  );
}

function BlocoAnalise({ titulo, a, regional }: { titulo: string; a: Analise; regional: boolean }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />{titulo}</CardTitle></CardHeader>
      <CardContent className="p-3 pt-1"><ConteudoAnalise a={a} regional={regional} /></CardContent>
    </Card>
  );
}

function ConteudoAnalise({ a, regional }: { a: Analise; regional: boolean }) {
  if (a.estado === 'sem_respostas') return <Aviso texto="Sem respostas no período." />;
  if (a.estado === 'amostra_insuficiente')
    return <Aviso texto={`Amostra limitada: são necessárias pelo menos ${a.minimo} respostas por divisão no período para mostrar a análise e os comentários, preservando o anonimato.`} />;
  if (a.estado === 'processando') return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Análise em processamento…</div>;
  if (a.estado === 'erro') return <Aviso texto={`Análise indisponível no momento. ${a.erro || ''}`} />;
  const pequena = (a.respostasIncluidas || 0) < 10;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[11px] text-muted-foreground">
        {a.estado === 'desatualizada' ? 'Atualizando com novas respostas · ' : ''}
        Baseado em {a.respostasIncluidas} respostas{regional ? ` de ${a.divisoesIncluidas} divisões` : ''}
        {a.geradoEm ? ` · análise de ${format(new Date(a.geradoEm), 'dd/MM HH:mm')}` : ''}
      </p>
      {pequena && <Aviso texto="Amostra pequena: trate os temas como indícios, não como conclusões." />}
      <Temas titulo="Pontos fortes" lista={a.pontosFortes} regional={regional} />
      <Temas titulo="Pontos fracos" lista={a.pontosFracos} regional={regional} />
      <Temas titulo="Sugestões de melhoria" lista={a.sugestoes} regional={regional} />
      {regional && <Temas titulo="Boas práticas para compartilhar" lista={a.boasPraticas} regional />}
      {a.diagnostico && (
        <div className="rounded-md border border-border p-2">
          <p className="text-xs font-semibold mb-1">Diagnóstico <Badge variant="outline" className="ml-1 text-[10px]">interpretação da IA</Badge></p>
          <p className="text-xs">{a.diagnostico}</p>
        </div>
      )}
      {!!a.recomendacoes?.length && (
        <div className="rounded-md border border-border p-2">
          <p className="text-xs font-semibold mb-1">Recomendações <Badge variant="outline" className="ml-1 text-[10px]">interpretação da IA</Badge></p>
          <ul className="list-disc pl-4 space-y-1 text-xs">{a.recomendacoes.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Temas({ titulo, lista, regional }: { titulo: string; lista?: Tema[]; regional: boolean }) {
  if (!lista?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold mb-1">{titulo} <span className="font-normal text-muted-foreground">(mencionados nas respostas)</span></p>
      <div className="space-y-1">
        {lista.map((t, i) => (
          <Collapsible key={i} className="rounded-md bg-muted/40">
            <CollapsibleTrigger className="w-full flex items-start justify-between gap-2 p-2 text-left">
              <span className="min-w-0">
                <span className="text-xs font-medium">{t.tema}</span>
                <span className="block text-[11px] text-muted-foreground">{t.resumo}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                {t.respostas} resp.{regional ? ` · ${t.divisoes} div.` : ''}{t.respostas === 1 ? ' (isolado)' : ''}<ChevronDown className="h-3 w-3" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pb-2 space-y-1">
              {t.comentarios.map((c, j) => <p key={j} className="text-[11px] border-l-2 border-primary/40 pl-2 break-words">“{c}”</p>)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function DivisaoItem({ v }: { v: { nome: string; indicadores: Ind; analise: Analise } }) {
  const sat = v.indicadores.medias[0];
  const top = (l?: Tema[]) => l?.slice(0, 2).map(t => t.tema).join(', ');
  return (
    <Collapsible className="rounded-md border border-border">
      <CollapsibleTrigger className="w-full p-2 text-left flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="text-xs font-semibold break-words">{nomeCurto(v.nome)}</span>
          <span className="block text-[11px] text-muted-foreground">
            <span className={`font-bold ${corParticipacao(v.indicadores)}`}>
              {v.indicadores.respostas}{v.indicadores.participacao && <> de {v.indicadores.participacao.integrantesAtivos}</>} resp.
              {v.indicadores.participacao?.percentual != null && <> · {fmt(v.indicadores.participacao.percentual)}%</>}
            </span>
            {' · '}{v.indicadores.medias.map(m => `${m.rotulo.split(' ')[0]} ${fmt(m.media)}`).join(' · ')}
          </span>
          {v.analise.estado === 'ok' || v.analise.estado === 'desatualizada' ? (
            <span className="block text-[11px] mt-0.5">
              {top(v.analise.pontosFortes) && <>+ {top(v.analise.pontosFortes)}<br /></>}
              {top(v.analise.pontosFracos) && <>− {top(v.analise.pontosFracos)}<br /></>}
              {top(v.analise.sugestoes) && <>→ {top(v.analise.sugestoes)}</>}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 flex items-center gap-1 text-sm font-bold">{fmt(sat.media)}<ChevronDown className="h-3 w-3" /></span>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-2 pt-0 space-y-2">
        <Atividades ind={v.indicadores} outros={[]} />
        <ConteudoAnalise a={v.analise} regional={false} />
      </CollapsibleContent>
    </Collapsible>
  );
}
