import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X, AlertCircle, Sparkles, TrendingUp, ChevronDown, ShieldCheck, ShieldX, Lock } from "lucide-react";
import { format, differenceInMonths, startOfDay, endOfDay, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildWaMeLink, renderTemplate, logEnvioWhatsApp, formatPhoneBR } from "@/lib/whatsapp";
import { useIntegrantesGestao } from "@/hooks/useIntegrantesGestao";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useFrequenciaPonderada } from "@/hooks/useFrequenciaPonderada";
import {
  usePeriodosAvaliacao,
  useCriteriosAvaliacao,
  useAvaliacoesIntegrantes,
  useUltimaPromocaoGrau,
  useMensalidadesAtrasoPeriodo,
  useDecisoesAvaliacao,
  upsertAvaliacao,
  upsertDecisaoAvaliacao,
  type DecisoesIntegrante,
} from "@/hooks/useAvaliacaoData";

interface Props {
  userId: string | undefined;
  regionalId: string | null;
  avaliadorNome: string | null;
  readOnly?: boolean;
  onDecisaoRegionalConcluida?: () => void;
}

type DecisionDialogState = {
  integranteId: string;
  integranteNome: string;
  etapa: 'divisao' | 'regional';
  decisao: 'aprovado' | 'reprovado';
  nota: number;
  exigeJustificativa: boolean;
  motivoExigencia?: string;
  ehDDIntegrante?: boolean;
} | null;

export function AvaliacaoTab({ userId, regionalId, avaliadorNome, readOnly, onDecisaoRegionalConcluida }: Props) {
  const { integrantesPorDivisao, loading: loadingInt } = useIntegrantesGestao(userId);
  const { profile } = useProfile(userId);
  const { hasRole } = useUserRole(userId);
  const { periodos, periodoAtualAberto, loading: loadingPer } = usePeriodosAvaliacao(regionalId);
  const { criterios, loading: loadingCrit } = useCriteriosAvaliacao(regionalId, true);

  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>("");
  const periodoId = periodoSelecionadoId || periodoAtualAberto?.id || periodos[0]?.id || "";
  const periodo = periodos.find(p => p.id === periodoId);

  const todosIntegrantes = useMemo(
    () => integrantesPorDivisao.flatMap(d => d.integrantes),
    [integrantesPorDivisao]
  );
  const integranteIds = useMemo(() => todosIntegrantes.map(i => i.id), [todosIntegrantes]);
  const grausPorRegistro = useMemo(() => {
    const m: Record<number, string | null> = {};
    todosIntegrantes.forEach(i => { m[i.registro_id] = i.grau ?? null; });
    return m;
  }, [todosIntegrantes]);

  const { avaliacoes, refetch } = useAvaliacoesIntegrantes(periodoId, integranteIds);
  const { decisoesMap, refetch: refetchDecisoes } = useDecisoesAvaliacao(periodoId, integranteIds);
  const promocoesMap = useUltimaPromocaoGrau(grausPorRegistro);

  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const [freqInicio, freqFim] = useMemo<[Date, Date]>(() => {
    if (periodo?.data_inicio && periodo?.data_fim) {
      return [startOfDay(parseLocalDate(periodo.data_inicio)), endOfDay(parseLocalDate(periodo.data_fim))];
    }
    return [startOfDay(subMonths(new Date(), 6)), endOfDay(new Date())];
  }, [periodo?.data_inicio, periodo?.data_fim]);

  const { data: frequenciaData } = useFrequenciaPonderada({
    dataInicio: freqInicio,
    dataFim: freqFim,
    regionalId: regionalId || undefined,
  });
  const freqMap = useMemo(() => {
    const m = new Map<string, any>();
    (frequenciaData || []).forEach((f: any) => m.set(f.integrante_id, f));
    return m;
  }, [frequenciaData]);

  const registroIds = useMemo(() => todosIntegrantes.map(i => i.registro_id), [todosIntegrantes]);
  const mensalidadesAtrasoMap = useMensalidadesAtrasoPeriodo(registroIds, freqInicio, freqFim);

  // Permissões agregadas
  const isAdminOrComando = hasRole('admin') || hasRole('comando');
  const isDiretorDivisao = hasRole('diretor_divisao');
  const isDiretorRegional = hasRole('diretor_regional');
  const userDivisaoId = profile?.divisao_id || null;
  const userRegionalId = profile?.regional_id || null;

  const isPeriodoAberto = periodo?.status === 'aberto';
  const podeAvaliar = !readOnly && isPeriodoAberto;

  // Estado do modal de decisão
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialogState>(null);
  const [justificativa, setJustificativa] = useState('');
  const [salvandoDecisao, setSalvandoDecisao] = useState(false);

  if (loadingInt || loadingPer || loadingCrit) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!regionalId) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem regional definida no perfil.</CardContent></Card>;
  }

  if (periodos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="text-sm font-medium">Nenhum período de avaliação cadastrado</p>
          <p className="text-xs text-muted-foreground">Solicite à coordenação a criação de um período em Gestão ADM.</p>
        </CardContent>
      </Card>
    );
  }

  const handleAvaliar = async (
    integranteId: string,
    criterioId: string,
    status: 'sim' | 'nao',
    observacao: string,
  ) => {
    if (!userId || !periodoId) return false;
    if (status === 'nao' && !observacao.trim()) {
      toast.error('Observação obrigatória ao reprovar o critério', { duration: 6000 });
      return false;
    }
    const ok = await upsertAvaliacao({
      periodo_id: periodoId,
      integrante_id: integranteId,
      criterio_id: criterioId,
      status,
      observacao: observacao.trim() || null,
      avaliador_id: userId,
      avaliador_nome: avaliadorNome ?? null,
    });
    if (ok) {
      toast.success('Avaliação registrada', { duration: 6000 });
      refetch();
      // Decisões já foram derrubadas no banco via trigger; refresca pra refletir
      refetchDecisoes();
    }
    return ok;
  };

  const abrirDecisao = (
    integrante: typeof todosIntegrantes[number],
    etapa: 'divisao' | 'regional',
    decisao: 'aprovado' | 'reprovado',
    nota: number,
    decisoesIntegrante: DecisoesIntegrante,
    ehDDIntegrante: boolean,
  ) => {
    let exigeJust = decisao === 'reprovado';
    let motivoExig: string | undefined;
    if (decisao === 'reprovado') motivoExig = 'Reprovação exige justificativa';
    // DR aprovando contra reprovação do DD: justificativa obrigatória
    if (etapa === 'regional' && decisao === 'aprovado' && decisoesIntegrante.divisao?.decisao === 'reprovado') {
      exigeJust = true;
      motivoExig = 'Você está aprovando contra a reprovação do Diretor de Divisão — justificativa obrigatória';
    }
    setJustificativa('');
    setDecisionDialog({
      integranteId: integrante.id,
      integranteNome: integrante.nome_colete,
      etapa,
      decisao,
      nota,
      exigeJustificativa: exigeJust,
      motivoExigencia: motivoExig,
      ehDDIntegrante,
    });
  };

  const notificarDDViaWhatsApp = async (
    integranteId: string,
    integranteNome: string,
    decisao: 'aprovado' | 'reprovado',
    observacao: string | null,
    waWindow: Window | null,
  ) => {
    try {
      // 1) Busca integrante (divisao_id + nome da divisão)
      const { data: integrante } = await supabase
        .from('integrantes_portal')
        .select('divisao_id, divisao_texto')
        .eq('id', integranteId)
        .maybeSingle();
      const divisaoId = integrante?.divisao_id;
      const divisaoTexto = integrante?.divisao_texto || '';
      if (!divisaoId) {
        waWindow?.close();
        toast.warning('Integrante sem divisão definida — DD não notificado', { duration: 6000 });
        return;
      }

      // 2) Busca DD ativo daquela divisão
      const { data: dds } = await supabase
        .from('integrantes_portal')
        .select('id, nome_colete, profile_id, cargo_grau_texto')
        .eq('divisao_id', divisaoId)
        .eq('ativo', true)
        .ilike('cargo_grau_texto', '%diretor%divis%');
      const dd = (dds || [])[0];
      if (!dd?.profile_id) {
        waWindow?.close();
        toast.warning('Diretor de Divisão não encontrado para notificação', { duration: 6000 });
        return;
      }

      // 3) Telefone do DD via profiles
      const { data: prof } = await supabase
        .from('profiles')
        .select('telefone')
        .eq('id', dd.profile_id)
        .maybeSingle();
      const telefone = formatPhoneBR(prof?.telefone || '');
      if (!telefone) {
        waWindow?.close();
        toast.warning(`Diretor de Divisão (${dd.nome_colete}) sem telefone cadastrado`, { duration: 6000 });
        return;
      }

      // 4) Template
      const { data: tpl } = await supabase
        .from('notificacoes_whatsapp_templates')
        .select('corpo, titulo')
        .eq('chave', 'avaliacao_dr_decisao')
        .eq('ativo', true)
        .maybeSingle();
      if (!tpl?.corpo) {
        waWindow?.close();
        toast.warning('Template "avaliacao_dr_decisao" não configurado', { duration: 6000 });
        return;
      }

      const payload = {
        nome_colete: integranteNome,
        divisao: divisaoTexto,
        status: decisao === 'aprovado' ? 'Aprovado' : 'Reprovado',
        observacao: observacao || '',
        avaliador: avaliadorNome || '',
      };
      const mensagem = renderTemplate(tpl.corpo, payload);
      const link = buildWaMeLink(telefone, mensagem);
      if (!link) {
        waWindow?.close();
        toast.error('Falha ao montar link do WhatsApp', { duration: 6000 });
        return;
      }

      // 5) Log + redireciona janela já aberta (preserva permissão de popup)
      logEnvioWhatsApp({
        remetente_profile_id: userId!,
        remetente_nome: avaliadorNome ?? null,
        destinatario_profile_id: dd.profile_id,
        destinatario_nome: dd.nome_colete,
        destinatario_telefone: telefone,
        template_chave: 'avaliacao_dr_decisao',
        template_titulo: tpl.titulo,
        mensagem_renderizada: mensagem,
        payload,
        modulo_origem: 'avaliacao_integrantes',
        regional_id: regionalId,
        divisao_id: divisaoId,
      });

      if (waWindow) {
        waWindow.location.href = link;
      } else {
        // Fallback caso popup tenha sido bloqueado
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error('[notificarDDViaWhatsApp]', e);
      waWindow?.close();
      toast.error('Erro ao notificar Diretor de Divisão', { duration: 6000 });
    }
  };

  const confirmarDecisao = async () => {
    if (!decisionDialog || !userId || !periodoId) return;
    if (decisionDialog.exigeJustificativa && !justificativa.trim()) {
      toast.error('Justificativa obrigatória', { duration: 6000 });
      return;
    }

    // Abre janela ANTES de qualquer await para preservar a permissão de popup
    // (apenas para decisões regionais — DR notifica DD)
    const isRegional = decisionDialog.etapa === 'regional';
    // Para integrantes Grau V / DD (etapa única) não há DD diferente do próprio integrante para notificar
    const deveNotificarDD = isRegional && !decisionDialog.ehDDIntegrante;
    const waWindow = deveNotificarDD ? window.open('about:blank', '_blank') : null;

    setSalvandoDecisao(true);
    const ok = await upsertDecisaoAvaliacao({
      periodo_id: periodoId,
      integrante_id: decisionDialog.integranteId,
      etapa: decisionDialog.etapa,
      decisao: decisionDialog.decisao,
      justificativa: justificativa.trim() || null,
      nota_calculada: decisionDialog.nota,
      decidido_por: userId,
      decidido_por_nome: avaliadorNome ?? null,
    });
    setSalvandoDecisao(false);
    if (!ok) {
      waWindow?.close();
      return;
    }

    toast.success(`Decisão ${decisionDialog.etapa === 'divisao' ? 'da Divisão' : 'Regional'} registrada`, { duration: 6000 });

    // Notificar Diretor Regional quando DD concluir
    if (decisionDialog.etapa === 'divisao') {
      supabase.functions
        .invoke('notificar-dr-avaliacao', {
          body: {
            periodo_id: periodoId,
            integrante_id: decisionDialog.integranteId,
            decisao_dd: decisionDialog.decisao,
            nota: decisionDialog.nota,
            decidido_por_nome: avaliadorNome ?? null,
          },
        })
        .catch((e) => console.error('[notificar-dr-avaliacao]', e));
    }

    // DR decidiu → notificar DD via WhatsApp manual (apenas quando há DD diferente do integrante)
    if (deveNotificarDD) {
      await notificarDDViaWhatsApp(
        decisionDialog.integranteId,
        decisionDialog.integranteNome,
        decisionDialog.decisao,
        justificativa.trim() || null,
        waWindow,
      );
    }

    setDecisionDialog(null);
    refetchDecisoes();

    // Ao concluir etapa regional, redirecionar para o Histórico
    if (isRegional) {
      onDecisaoRegionalConcluida?.();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1">Período de avaliação</div>
            <Select value={periodoId} onValueChange={setPeriodoSelecionadoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} {p.status === 'encerrado' ? '(encerrado)' : '(aberto)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {todosIntegrantes.length} integrantes no escopo · {criterios.length} critérios
          </div>
        </CardContent>
      </Card>

      {!isPeriodoAberto && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Período encerrado — visualização apenas.
        </div>
      )}

      {criterios.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhum critério ativo. Cadastre critérios em Gestão ADM → Critérios de Avaliação.
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="space-y-2">
        {integrantesPorDivisao.map(grupo => {
          let pendentesDR = 0;
          let totalAbertos = 0;
          grupo.integrantes.forEach(int => {
            const decs = decisoesMap[int.id] || {};
            if (decs.regional) return;
            totalAbertos++;
            const ehDD =
              (int.grau || '').trim().toUpperCase() === 'V' ||
              /diretor.*divis/i.test(int.cargo_grau_texto || '');
            const respondidos = new Set(
              avaliacoes.filter(a => a.integrante_id === int.id).map(a => a.criterio_id)
            ).size;
            const todosResp = criterios.length > 0 && respondidos === criterios.length;
            const prontoParaDR = ehDD ? todosResp : !!decs.divisao;
            if (prontoParaDR) pendentesDR++;
          });
          if (totalAbertos === 0) return null;
          const temPendenteDR = pendentesDR > 0;
          return (
          <AccordionItem
            key={grupo.divisaoId || 'sem'}
            value={grupo.divisaoId || 'sem'}
            className={`border rounded-md overflow-hidden ${
              temPendenteDR ? 'bg-amber-500/10 border-amber-500/50' : 'bg-card'
            }`}
          >
            <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/30">
              <div className="flex items-center gap-2 text-left flex-wrap">
                <span className="text-sm font-semibold">{grupo.divisaoNome}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {totalAbertos}
                </Badge>
                {temPendenteDR && (
                  <Badge className="text-[10px] bg-amber-600 hover:bg-amber-600 text-white">
                    {pendentesDR} pend. DR
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-2">
              <Accordion type="single" collapsible className="space-y-2">

            {grupo.integrantes.map(int => {
              const dataPromocao = promocoesMap[int.registro_id];
              const recente = dataPromocao && differenceInMonths(new Date(), new Date(dataPromocao)) < 6;
              const minhasAvalsInt = avaliacoes.filter(a => a.integrante_id === int.id);
              const totalRespondidos = new Set(minhasAvalsInt.map(a => a.criterio_id)).size;
              const todosRespondidos = criterios.length > 0 && totalRespondidos === criterios.length;

              // Cálculo da nota final (sempre sobre o total de critérios ativos)
              const somaPesosTotal = criterios.reduce((s, c) => s + Number(c.peso || 0), 0);
              const somaPesosSim = criterios.reduce((s, c) => {
                const av = minhasAvalsInt.find(a => a.criterio_id === c.id);
                return av?.status === 'sim' ? s + Number(c.peso || 0) : s;
              }, 0);
              const notaFinal = somaPesosTotal > 0 ? Math.round((somaPesosSim / somaPesosTotal) * 100 * 10) / 10 : 0;

              const decs = decisoesMap[int.id] || {};
              const decDD = decs.divisao;
              const decDR = decs.regional;

              // Integrante avaliado diretamente pelo DR em etapa única:
              // - Diretores de Divisão (Grau VI)
              // - Todos os integrantes de Grau V (regionais)
              const ehDDIntegrante =
                (int.grau || '').trim().toUpperCase() === 'V' ||
                /diretor.*divis/i.test(int.cargo_grau_texto || '');

              // Permissões para esta linha
              const ehMinhaDivisao = !!userDivisaoId && int.divisao_id === userDivisaoId;
              const ehMinhaRegional = !!userRegionalId && int.regional_id === userRegionalId;
              const podeDecidirDivisao = !ehDDIntegrante && podeAvaliar && (isAdminOrComando || (isDiretorDivisao && ehMinhaDivisao));
              const podeDecidirRegional = podeAvaliar && (isAdminOrComando || (isDiretorRegional && ehMinhaRegional)) && (ehDDIntegrante || !!decDD);

              const freq: any = freqMap.get(int.id);
              const pct = freq ? Math.round(freq.percentual) : null;
              const breakdown: Record<string, number> = {};
              if (freq) {
                for (const ev of freq.eventos) {
                  if (ev.status === 'ausente') {
                    const key = ev.justificativa || 'Não justificou';
                    breakdown[key] = (breakdown[key] || 0) + 1;
                  }
                }
              }
              const pctColor = pct === null ? 'bg-muted text-muted-foreground'
                : pct >= 70 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : pct >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40';

              // Status global do integrante para badge no header
              const statusBadge = decDR
                ? (decDR.decisao === 'aprovado'
                    ? <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white gap-1"><ShieldCheck className="h-3 w-3" />Aprovado</Badge>
                    : <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600 text-white gap-1"><ShieldX className="h-3 w-3" />Reprovado</Badge>)
                : ehDDIntegrante
                ? <Badge variant="outline" className="text-[10px]">Pendente DR</Badge>
                : decDD
                ? (decDD.decisao === 'aprovado'
                    ? <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40">Aguardando DR</Badge>
                    : <Badge variant="outline" className="text-[10px] gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40">Reprovado pela DD · Aguardando DR</Badge>)
                : <Badge variant="outline" className="text-[10px]">Pendente DD</Badge>;

              return (
                <AccordionItem key={int.id} value={int.id} className="border rounded-md bg-card">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs">{int.nome_colete?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{int.nome_colete}</span>
                          <Badge variant="outline" className="text-[10px]">Grau {int.grau}</Badge>
                          {recente && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 gap-1">
                              <Sparkles className="h-3 w-3" />Promoção recente
                            </Badge>
                          )}
                          {pct !== null && (
                            <Badge variant="outline" className={`text-[10px] gap-1 ${pctColor}`}>
                              <TrendingUp className="h-3 w-3" />{pct}%
                            </Badge>
                          )}
                          {statusBadge}
                          {(() => {
                            const info = mensalidadesAtrasoMap[int.registro_id];
                            if (!info) return null;
                            return (
                              <>
                                {info.abertas > 0 && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40">
                                    {info.abertas} mens. em aberto
                                  </Badge>
                                )}
                                {info.pagasAtraso > 0 && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/40">
                                    {info.pagasAtraso} pag{info.pagasAtraso === 1 ? 'a' : 'as'} em atraso
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {int.cargo_grau_texto}
                          {dataPromocao && ` · promoção ${format(new Date(dataPromocao), 'dd/MM/yy', { locale: ptBR })}`}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {totalRespondidos}/{criterios.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-3">
                    {freq && (
                      <div className="rounded-md border bg-muted/20 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />Participação no período
                          </span>
                          <span className="font-semibold">{pct}% · {freq.totalEventos} evento{freq.totalEventos === 1 ? '' : 's'}</span>
                        </div>
                        <Progress value={pct ?? 0} className="h-1.5" />
                        {Object.keys(breakdown).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {Object.entries(breakdown).sort((a,b) => b[1]-a[1]).map(([j, n]) => (
                              <Badge key={j} variant="outline" className={`text-[10px] ${
                                j === 'Não justificou'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40'
                                  : 'bg-muted/50'
                              }`}>
                                {j}: {n}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {freq.eventos && freq.eventos.length > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground pt-1 group">
                              <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                              Ver eventos do período ({freq.eventos.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1">
                              <div className="space-y-1 max-h-60 overflow-auto pr-1">
                                {[...freq.eventos]
                                  .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                  .map((ev: any, idx: number) => {
                                    const isAusente = ev.status === 'ausente';
                                    const isPresente = ev.status === 'presente';
                                    const naoJust = isAusente && (!ev.justificativa || ev.justificativa === 'Não justificou');
                                    const dotColor = isPresente
                                      ? 'bg-emerald-500'
                                      : naoJust
                                      ? 'bg-rose-500'
                                      : 'bg-amber-500';
                                    return (
                                      <div key={idx} className="flex items-start gap-2 text-[11px] border-l-2 pl-2 py-0.5"
                                        style={{ borderColor: 'hsl(var(--border))' }}>
                                        <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="truncate font-medium">{ev.titulo}</div>
                                          <div className="text-muted-foreground">
                                            {format(new Date(ev.data), "dd/MM/yy", { locale: ptBR })}
                                            {' · '}
                                            {isPresente ? 'Presente' : isAusente ? (ev.justificativa || 'Não justificou') : ev.status}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    )}

                    {criterios.map(c => {
                      const ava = minhasAvalsInt.find(a => a.criterio_id === c.id);
                      return (
                        <CriterioRow
                          key={c.id}
                          criterio={c}
                          atual={ava}
                          podeEditar={podeAvaliar}
                          onSalvar={(status, obs) => handleAvaliar(int.id, c.id, status, obs)}
                        />
                      );
                    })}

                    {/* Rodapé: nota final + decisões */}
                    <div className="rounded-md border-2 bg-muted/40 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Nota final</span>
                          <span className="text-2xl font-bold tabular-nums">{notaFinal.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {totalRespondidos} de {criterios.length} critérios respondidos
                        </Badge>
                      </div>

                      {/* Etapa 1 — Diretor de Divisão (oculta quando o avaliado é DD) */}
                      {!ehDDIntegrante && (
                        <DecisaoLinha
                          titulo="1. Diretor de Divisão"
                          decisao={decDD}
                          podeAgir={podeDecidirDivisao}
                          bloqueioMsg={
                            !podeAvaliar ? null
                            : !podeDecidirDivisao ? 'Apenas o Diretor de Divisão deste integrante pode concluir esta etapa'
                            : !todosRespondidos ? `Responda todos os ${criterios.length} critérios para concluir`
                            : null
                          }
                          habilitarBotoes={podeDecidirDivisao && todosRespondidos}
                          onAprovar={() => abrirDecisao(int, 'divisao', 'aprovado', notaFinal, decs, ehDDIntegrante)}
                          onReprovar={() => abrirDecisao(int, 'divisao', 'reprovado', notaFinal, decs, ehDDIntegrante)}
                        />
                      )}

                      {/* Etapa final — Diretor Regional */}
                      <DecisaoLinha
                        titulo={ehDDIntegrante ? 'Diretor Regional (avaliação)' : '2. Diretor Regional (validação final)'}
                        decisao={decDR}
                        podeAgir={podeDecidirRegional}
                        bloqueioMsg={
                          !podeAvaliar ? null
                          : ehDDIntegrante && !todosRespondidos ? `Responda todos os ${criterios.length} critérios para concluir`
                          : !ehDDIntegrante && !decDD ? 'Aguardando decisão do Diretor de Divisão'
                          : !podeDecidirRegional ? 'Apenas o Diretor Regional desta regional pode concluir esta etapa'
                          : null
                        }
                        habilitarBotoes={podeDecidirRegional && (!ehDDIntegrante || todosRespondidos)}
                        onAprovar={() => abrirDecisao(int, 'regional', 'aprovado', notaFinal, decs, ehDDIntegrante)}
                        onReprovar={() => abrirDecisao(int, 'regional', 'reprovado', notaFinal, decs, ehDDIntegrante)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
          );
        })}
      </Accordion>


      {/* Modal de decisão */}
      <Dialog open={!!decisionDialog} onOpenChange={(open) => !open && setDecisionDialog(null)}>
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionDialog?.decisao === 'aprovado'
                ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
                : <ShieldX className="h-5 w-5 text-rose-600" />}
              {decisionDialog?.decisao === 'aprovado' ? 'Aprovar' : 'Reprovar'} — {decisionDialog?.etapa === 'divisao' ? 'Divisão' : 'Regional'}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog?.integranteNome} · Nota {decisionDialog?.nota.toFixed(1)} / 100
            </DialogDescription>
          </DialogHeader>
          {decisionDialog?.motivoExigencia && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {decisionDialog.motivoExigencia}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Justificativa {decisionDialog?.exigeJustificativa ? <span className="text-rose-600">*</span> : <span className="text-muted-foreground">(opcional)</span>}
            </label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={decisionDialog?.exigeJustificativa ? 'Descreva o motivo da decisão...' : 'Comentário (opcional)'}
              className="min-h-[100px] text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDecisionDialog(null)} disabled={salvandoDecisao}>Cancelar</Button>
            <Button
              onClick={confirmarDecisao}
              disabled={salvandoDecisao}
              className={decisionDialog?.decisao === 'aprovado' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {salvandoDecisao && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar {decisionDialog?.decisao === 'aprovado' ? 'aprovação' : 'reprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DecisaoLinha({
  titulo, decisao, habilitarBotoes, bloqueioMsg, onAprovar, onReprovar,
}: {
  titulo: string;
  decisao?: { decisao: 'aprovado' | 'reprovado'; justificativa: string | null; decidido_por_nome: string | null; decidido_em: string };
  podeAgir: boolean;
  habilitarBotoes: boolean;
  bloqueioMsg: string | null;
  onAprovar: () => void;
  onReprovar: () => void;
}) {
  return (
    <div className="rounded-md border bg-background p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold">{titulo}</span>
        {decisao ? (
          decisao.decisao === 'aprovado'
            ? <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white gap-1"><ShieldCheck className="h-3 w-3" />Aprovado</Badge>
            : <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600 text-white gap-1"><ShieldX className="h-3 w-3" />Reprovado</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Pendente</Badge>
        )}
      </div>
      {decisao && (
        <div className="text-[11px] text-muted-foreground">
          Por <span className="font-medium text-foreground">{decisao.decidido_por_nome || '—'}</span>
          {' · '}{format(new Date(decisao.decidido_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
        </div>
      )}
      {decisao?.justificativa && (
        <div className="text-[11px] bg-muted/50 rounded p-1.5 italic">"{decisao.justificativa}"</div>
      )}
      {bloqueioMsg && !decisao && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" />{bloqueioMsg}
        </div>
      )}
      {habilitarBotoes && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-8 text-xs flex-1 border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700"
            onClick={onAprovar}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            {decisao ? 'Alterar para Aprovado' : 'Aprovar'}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs flex-1 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-700"
            onClick={onReprovar}>
            <ShieldX className="h-3.5 w-3.5 mr-1" />
            {decisao ? 'Alterar para Reprovado' : 'Reprovar'}
          </Button>
        </div>
      )}
    </div>
  );
}

function CriterioRow({
  criterio, atual, podeEditar, onSalvar,
}: {
  criterio: { id: string; nome: string; descricao: string | null; peso: number };
  atual?: { status: 'sim' | 'nao'; observacao: string | null };
  podeEditar: boolean;
  onSalvar: (status: 'sim' | 'nao', obs: string) => Promise<boolean | void> | void;
}) {
  const [obs, setObs] = useState(atual?.observacao || '');
  const [editandoObs, setEditandoObs] = useState(false);

  const handleReprovar = async () => {
    if (!obs.trim()) {
      setEditandoObs(true);
      toast.error('Observação obrigatória ao reprovar este critério', { duration: 6000 });
      return;
    }
    await onSalvar('nao', obs);
  };

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
            {criterio.nome}
            <Badge variant="outline" className="text-[10px]">peso {Number(criterio.peso || 0).toFixed(1)}</Badge>
          </div>
          {criterio.descricao && <div className="text-[11px] text-muted-foreground">{criterio.descricao}</div>}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant={atual?.status === 'sim' ? 'default' : 'outline'}
            className={atual?.status === 'sim' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
            disabled={!podeEditar}
            onClick={() => onSalvar('sim', obs)}
          ><Check className="h-4 w-4" /></Button>
          <Button
            size="sm"
            variant={atual?.status === 'nao' ? 'default' : 'outline'}
            className={atual?.status === 'nao' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}
            disabled={!podeEditar}
            onClick={handleReprovar}
          ><X className="h-4 w-4" /></Button>
        </div>
      </div>
      {(editandoObs || atual?.observacao || atual?.status === 'nao') && (
        <div className="space-y-1">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder={atual?.status === 'nao' ? "Observação (obrigatória ao reprovar)" : "Observação (opcional)"}
            disabled={!podeEditar}
            className="text-xs min-h-[60px]"
          />
          {podeEditar && atual && (
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => onSalvar(atual.status, obs)}>
              Atualizar observação
            </Button>
          )}
        </div>
      )}
      {!editandoObs && !atual?.observacao && atual?.status !== 'nao' && podeEditar && (
        <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground"
          onClick={() => setEditandoObs(true)}>+ adicionar observação</Button>
      )}
    </div>
  );
}
