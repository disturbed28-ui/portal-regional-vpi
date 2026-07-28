import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, MessageCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  renderTemplate,
  logEnvioWhatsApp,
  formatPhoneBR,
  openWhatsAppConversation,
  isMobileWhatsAppEnvironment,
} from "@/lib/whatsapp";
import { useIntegrantesGestao } from "@/hooks/useIntegrantesGestao";
import { useProfile } from "@/hooks/useProfile";
import {
  usePeriodosAvaliacao,
  useCriteriosAvaliacao,
  useAvaliacoesIntegrantes,
  useDecisoesAvaliacao,
} from "@/hooks/useAvaliacaoData";

interface Props {
  userId: string | undefined;
  regionalId: string | null;
  readOnly?: boolean;
}

interface DiretorInfo {
  profileId: string | null;
  nome: string;
  telefone: string | null;
}

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export function PendenciasAvaliacaoTab({ userId, regionalId, readOnly }: Props) {
  const { integrantesPorDivisao, loading: loadingInt } = useIntegrantesGestao(userId);
  const { profile } = useProfile(userId);
  const { periodos, periodoAtualAberto, loading: loadingPer } = usePeriodosAvaliacao(regionalId);
  const { criterios, loading: loadingCrit } = useCriteriosAvaliacao(regionalId, true);

  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>("");
  const periodoId = periodoSelecionadoId || periodoAtualAberto?.id || periodos[0]?.id || "";
  const periodo = periodos.find((p) => p.id === periodoId);

  const todosIntegrantes = useMemo(
    () => integrantesPorDivisao.flatMap((d) => d.integrantes),
    [integrantesPorDivisao],
  );
  const integranteIds = useMemo(() => todosIntegrantes.map((i) => i.id), [todosIntegrantes]);

  const { avaliacoes } = useAvaliacoesIntegrantes(periodoId, integranteIds);
  const { decisoesMap } = useDecisoesAvaliacao(periodoId, integranteIds);

  const [enviandoDivisaoId, setEnviandoDivisaoId] = useState<string | null>(null);

  const remetente = profile?.nome_colete || profile?.name || "";

  // Agrupamento das pendências
  const grupos = useMemo(() => {
    const criteriosIds = criterios.map((c) => c.id);
    return integrantesPorDivisao
      .map((grupo) => {
        const pendentesDD: typeof grupo.integrantes = [];
        const pendentesDR: typeof grupo.integrantes = [];

        grupo.integrantes.forEach((int) => {
          const decs = decisoesMap[int.id] || {};
          if (decs.regional) return; // já finalizado pelo DR

          const respondidos = new Set(
            avaliacoes.filter((a) => a.integrante_id === int.id).map((a) => a.criterio_id),
          );
          const todosResp =
            criteriosIds.length > 0 && criteriosIds.every((cid) => respondidos.has(cid));

          const ehDD =
            (int.grau || "").trim().toUpperCase() === "V" ||
            /diretor.*divis/i.test(int.cargo_grau_texto || "");

          if (ehDD) {
            // Avaliado diretamente pelo Diretor Regional
            pendentesDR.push(int);
            return;
          }

          // Pendente com o DD enquanto não houver decisão de divisão
          if (!decs.divisao || !todosResp) pendentesDD.push(int);
        });

        return { ...grupo, pendentesDD, pendentesDR };
      })
      .filter((g) => g.pendentesDD.length > 0 || g.pendentesDR.length > 0);
  }, [integrantesPorDivisao, decisoesMap, avaliacoes, criterios]);

  const totalPendentes = grupos.reduce((s, g) => s + g.pendentesDD.length, 0);

  const buscarDiretor = async (divisaoId: string | null): Promise<DiretorInfo | null> => {
    if (!divisaoId) return null;
    const { data: dds } = await supabase
      .from("integrantes_portal")
      .select("nome_colete, profile_id, cargo_grau_texto")
      .eq("divisao_id", divisaoId)
      .eq("ativo", true)
      .ilike("cargo_grau_texto", "%diretor%divis%")
      .not("cargo_grau_texto", "ilike", "%sub%");
    const dd = (dds || [])[0];
    if (!dd) return null;

    let telefone: string | null = null;
    if (dd.profile_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("telefone")
        .eq("id", dd.profile_id)
        .maybeSingle();
      telefone = prof?.telefone || null;
    }
    return { profileId: dd.profile_id ?? null, nome: dd.nome_colete || "Diretor", telefone };
  };

  const cobrarDiretor = async (grupo: (typeof grupos)[number]) => {
    if (!periodo || !userId) return;
    const waWindow = !isMobileWhatsAppEnvironment() ? window.open("about:blank", "_blank") : null;
    setEnviandoDivisaoId(grupo.divisaoId || "sem");
    try {
      const diretor = await buscarDiretor(grupo.divisaoId);
      if (!diretor) {
        waWindow?.close();
        toast.warning("Diretor de Divisão não encontrado para esta divisão", { duration: 6000 });
        return;
      }
      const telefone = formatPhoneBR(diretor.telefone || "");
      if (!telefone) {
        waWindow?.close();
        toast.warning(`Diretor (${diretor.nome}) sem telefone cadastrado`, { duration: 6000 });
        return;
      }

      const { data: tpl } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("corpo, titulo")
        .eq("chave", "avaliacao_pendencia_dd")
        .eq("ativo", true)
        .maybeSingle();
      if (!tpl?.corpo) {
        waWindow?.close();
        toast.warning('Template "avaliacao_pendencia_dd" não configurado', { duration: 6000 });
        return;
      }

      const lista = grupo.pendentesDD
        .map((i) => `• ${i.nome_colete || "—"}`)
        .join("\n");

      const payload = {
        diretor: diretor.nome,
        periodo: periodo.nome,
        divisao: grupo.divisaoNome,
        total: grupo.pendentesDD.length,
        lista,
        data_fim: periodo.data_fim ? format(parseLocalDate(periodo.data_fim), "dd/MM/yyyy") : "",
        remetente,
      };
      const mensagem = renderTemplate(tpl.corpo, payload);

      const abriu = openWhatsAppConversation({ telefone, mensagem, targetWindow: waWindow });
      if (!abriu) {
        waWindow?.close();
        toast.error("Falha ao montar link do WhatsApp", { duration: 6000 });
        return;
      }

      logEnvioWhatsApp({
        remetente_profile_id: userId,
        remetente_nome: remetente || null,
        destinatario_profile_id: diretor.profileId,
        destinatario_nome: diretor.nome,
        destinatario_telefone: telefone,
        template_chave: "avaliacao_pendencia_dd",
        template_titulo: tpl.titulo,
        mensagem_renderizada: mensagem,
        payload,
        modulo_origem: "avaliacao_pendencias",
        regional_id: regionalId,
        divisao_id: grupo.divisaoId,
      });
    } catch (e) {
      console.error("[cobrarDiretor]", e);
      waWindow?.close();
      toast.error("Erro ao notificar Diretor de Divisão", { duration: 6000 });
    } finally {
      setEnviandoDivisaoId(null);
    }
  };

  if (loadingInt || loadingPer || loadingCrit) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!regionalId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sem regional definida no perfil.
        </CardContent>
      </Card>
    );
  }

  if (periodos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="text-sm font-medium">Nenhum período de avaliação cadastrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Período de avaliação</p>
          <Select value={periodoId} onValueChange={setPeriodoSelecionadoId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} {p.status === "aberto" ? "(aberto)" : "(encerrado)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[10px]">
              {totalPendentes} pendente(s) com Diretores de Divisão
            </Badge>
          </div>
        </CardContent>
      </Card>

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="text-sm font-medium">Nenhuma pendência neste período</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {grupos.map((grupo) => {
            const key = grupo.divisaoId || "sem";
            const enviando = enviandoDivisaoId === key;
            const podeCobrar = !readOnly && !!grupo.divisaoId && grupo.pendentesDD.length > 0;
            return (
              <AccordionItem
                key={key}
                value={key}
                className={`border rounded-md overflow-hidden ${
                  grupo.pendentesDD.length > 0 ? "bg-amber-500/10 border-amber-500/50" : "bg-card"
                }`}
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center gap-2 text-left flex-wrap">
                    <span className="text-sm font-semibold">{grupo.divisaoNome}</span>
                    {grupo.pendentesDD.length > 0 && (
                      <Badge className="text-[10px] bg-amber-600 hover:bg-amber-600 text-white">
                        {grupo.pendentesDD.length} pendente(s)
                      </Badge>
                    )}
                    {grupo.pendentesDR.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {grupo.pendentesDR.length} com o DR
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 space-y-3">
                  {grupo.pendentesDD.length > 0 && (
                    <div className="space-y-1">
                      {grupo.pendentesDD.map((i) => (
                        <div
                          key={i.id}
                          className="text-xs px-2 py-1.5 rounded bg-background border border-border/60"
                        >
                          {i.nome_colete}
                        </div>
                      ))}
                    </div>
                  )}

                  {grupo.pendentesDR.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Pendentes com o Diretor Regional
                      </p>
                      {grupo.pendentesDR.map((i) => (
                        <div
                          key={i.id}
                          className="text-xs px-2 py-1.5 rounded bg-muted/40 border border-border/40"
                        >
                          {i.nome_colete}
                        </div>
                      ))}
                    </div>
                  )}

                  {grupo.pendentesDD.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block">
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={!podeCobrar || enviando}
                              onClick={() => cobrarDiretor(grupo)}
                            >
                              {enviando ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageCircle className="h-3.5 w-3.5" />
                              )}
                              Cobrar Diretor
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!podeCobrar && (
                          <TooltipContent>
                            {readOnly ? "Somente leitura" : "Divisão sem diretor vinculado"}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
