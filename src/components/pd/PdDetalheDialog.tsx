import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CheckCircle2, FileText, Gavel, MessageCircle, Send, Save, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildWaMeLink } from "@/lib/whatsapp";
import {
  STATUS_LABEL, formatarNumeroPD, formatarDataHoraBR, podeCancelar, mensagemEncaminhamento, mensagemConclusao,
  type PdStatus, type Envolvido,
} from "@/lib/processoDisciplinar";
import { PdConteudoView } from "./PdConteudoView";
import { PdConteudoForm, errosConteudo, type PdConteudo } from "./PdConteudoForm";

const toast6 = { duration: 6000, dismissible: false };

function abrirLink(href: string) {
  const a = document.createElement("a");
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a); a.click(); a.remove();
}
const linkSemNumero = (msg: string) => `https://wa.me/?text=${encodeURIComponent(msg)}`;

function Secao({ titulo, icon: Icon, children }: { titulo: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 space-y-3 p-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><Icon className="h-4 w-4" />{titulo}</h3>
      {children}
    </Card>
  );
}

export function PdDetalheDialog({ pdId, onClose }: { pdId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState<(PdConteudo & { parecer: string }) | null>(null);
  const [modal, setModal] = useState<"devolutiva" | "cancelar" | null>(null);
  const [dev, setDev] = useState({ decisao: "", acao: "", observacoes: "" });
  const [justificativa, setJustificativa] = useState("");
  const [linkEmissor, setLinkEmissor] = useState<string | null>(null);

  const { data: pd, refetch } = useQuery({
    queryKey: ["pd", pdId],
    enabled: !!pdId,
    queryFn: async () => {
      const { data, error } = await supabase.from("processos_disciplinares").select("*").eq("id", pdId!).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: eventos, refetch: refetchEv } = useQuery({
    queryKey: ["pd-eventos", pdId],
    enabled: !!pdId,
    queryFn: async () => {
      const { data } = await supabase.from("processos_disciplinares_eventos").select("*").eq("pd_id", pdId!).order("created_at");
      return data ?? [];
    },
  });
  const { data: podeTratar = false } = useQuery({
    queryKey: ["pd-pode-tratar", pd?.divisao_id, pd?.regional_id],
    enabled: !!pd,
    queryFn: async () => {
      const { data } = await supabase.rpc("pd_pode_tratar", { _divisao_id: pd!.divisao_id as any, _regional_id: pd!.regional_id as any });
      return !!data;
    },
  });

  const recarregar = () => { refetch(); refetchEv(); qc.invalidateQueries({ queryKey: ["pds"] }); };

  const acao = async (nome: string, dados: Record<string, unknown> = {}) => {
    setOcupado(true);
    const { error } = await supabase.rpc("pd_acao", { _id: pdId!, _acao: nome, _dados: dados as any });
    setOcupado(false);
    if (error) { toast.error(error.message, toast6); return false; }
    recarregar();
    return true;
  };

  // Marca "Em análise Regional" quando quem trata abre pela primeira vez
  useEffect(() => {
    if (pd?.status === "emitido" && podeTratar) acao("abrir");
  }, [pd?.status, podeTratar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pd?.status === "versao_regional") {
      setVersao({
        titulo: pd.regional_titulo ?? "", envolvidos: (pd.regional_envolvidos as unknown as Envolvido[]) ?? [],
        local: pd.regional_local ?? "", data_ocorrencia: pd.regional_data_ocorrencia ?? "",
        hora_ocorrencia: pd.regional_hora_ocorrencia ?? "", descricao: pd.regional_descricao ?? "",
        houve_conciliacao: pd.regional_houve_conciliacao, conciliacao_descricao: pd.regional_conciliacao_descricao ?? "",
        parecer: pd.regional_parecer ?? "",
      });
    } else setVersao(null);
  }, [pd?.id, pd?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLinkEmissor(null); }, [pdId]);

  if (!pd) return <Dialog open={!!pdId} onOpenChange={(o) => !o && onClose()}><DialogContent className="w-[98vw] max-w-2xl" /></Dialog>;

  const status = pd.status as PdStatus;
  const numero = formatarNumeroPD(pd.numero, pd.ano);
  const original = { ...pd, envolvidos: pd.envolvidos as unknown as Envolvido[] };
  const temRegional = !!pd.regional_titulo;
  const regionalLeitura = {
    titulo: pd.regional_titulo, envolvidos: pd.regional_envolvidos as unknown as Envolvido[], local: pd.regional_local,
    data_ocorrencia: pd.regional_data_ocorrencia, hora_ocorrencia: pd.regional_hora_ocorrencia, descricao: pd.regional_descricao,
    houve_conciliacao: pd.regional_houve_conciliacao, conciliacao_descricao: pd.regional_conciliacao_descricao,
  };

  const dadosVersao = () => versao && ({
    titulo: versao.titulo.trim(), envolvidos: versao.envolvidos, local: versao.local.trim(),
    data_ocorrencia: versao.data_ocorrencia, hora_ocorrencia: versao.hora_ocorrencia,
    descricao: versao.descricao.trim(), houve_conciliacao: !!versao.houve_conciliacao,
    conciliacao_descricao: versao.houve_conciliacao ? versao.conciliacao_descricao.trim() : null,
    parecer: versao.parecer.trim() || null,
  });

  const encaminhar = async () => {
    if (!versao) return;
    const e = errosConteudo(versao);
    if (e.length) { toast.error("Preencha: " + e.join(", "), toast6); return; }
    const d = dadosVersao()!;
    abrirLink(linkSemNumero(mensagemEncaminhamento(numero, pd.divisao_texto ?? "-", d as any, d.parecer)));
    if (await acao("encaminhar", d)) toast.success("Encaminhado ao CMD Regional", toast6);
  };

  const concluir = async () => {
    if (!(await acao("concluir"))) return;
    const msg = mensagemConclusao(numero, pd.titulo, pd.devolutiva_decisao!, pd.devolutiva_acao!, pd.devolutiva_observacoes);
    const { data: perfil } = await supabase.from("profiles").select("telefone").eq("id", pd.autor_profile_id).maybeSingle();
    setLinkEmissor((perfil?.telefone && buildWaMeLink(perfil.telefone, msg)) || linkSemNumero(msg));
    toast.success("PD concluído", toast6);
  };

  return (
    <Dialog open={!!pdId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[98vw] max-w-2xl overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 break-words">
            <Gavel className="h-5 w-5 text-primary" />{numero}
          </DialogTitle>
          <Badge variant={status === "cancelado" ? "destructive" : status === "concluido" ? "default" : "secondary"} className="w-fit">
            {STATUS_LABEL[status]}
          </Badge>
          <p className="break-words text-xs text-muted-foreground">Emissor: {pd.autor_nome} · {pd.divisao_texto}</p>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          {linkEmissor && (
            <Button size="lg" className="w-full gap-2" onClick={() => abrirLink(linkEmissor)}>
              <MessageCircle className="h-5 w-5" />Enviar conclusão ao emissor
            </Button>
          )}

          <Secao titulo="Versão Original — emitida pela divisão" icon={FileText}>
            <PdConteudoView c={original} />
          </Secao>

          {status === "versao_regional" && podeTratar && versao ? (
            <Secao titulo="Versão Regional — em elaboração" icon={FileText}>
              <PdConteudoForm valor={versao} onChange={(v) => setVersao({ ...versao, ...v })} />
              <div className="space-y-1">
                <Label className="text-sm">Parecer Regional (opcional)</Label>
                <Textarea rows={4} value={versao.parecer} onChange={(e) => setVersao({ ...versao, parecer: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="lg" variant="outline" className="gap-2" disabled={ocupado}
                  onClick={async () => { if (await acao("salvar_versao", dadosVersao()!)) toast.success("Rascunho da versão Regional salvo", toast6); }}>
                  <Save className="h-4 w-4" />Salvar rascunho
                </Button>
                <Button size="lg" className="gap-2" disabled={ocupado} onClick={encaminhar}>
                  <Send className="h-4 w-4" />Encaminhar ao CMD Regional
                </Button>
              </div>
            </Secao>
          ) : temRegional && (
            <Secao titulo={`Versão Regional — ${pd.regional_autor_nome ?? ""}`} icon={FileText}>
              <PdConteudoView c={regionalLeitura} />
              {pd.regional_parecer && (
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Parecer Regional</p>
                  <p className="whitespace-pre-wrap break-words text-sm">{pd.regional_parecer}</p></div>
              )}
            </Secao>
          )}

          {pd.devolutiva_decisao && (
            <Secao titulo="Devolutiva do CMD Regional" icon={ClipboardCheck}>
              <div className="space-y-2 text-sm">
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Decisão</p><p className="whitespace-pre-wrap break-words">{pd.devolutiva_decisao}</p></div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Ação a ser tomada</p><p className="whitespace-pre-wrap break-words">{pd.devolutiva_acao}</p></div>
                {pd.devolutiva_observacoes && <div><p className="text-xs font-semibold uppercase text-muted-foreground">Observações</p><p className="whitespace-pre-wrap break-words">{pd.devolutiva_observacoes}</p></div>}
              </div>
            </Secao>
          )}

          {status === "cancelado" && (
            <Secao titulo="Cancelamento" icon={Ban}>
              <p className="whitespace-pre-wrap break-words text-sm">{pd.cancelamento_justificativa}</p>
              <p className="text-xs text-muted-foreground">{pd.cancelado_por_nome} · {formatarDataHoraBR(pd.cancelado_em)}</p>
            </Secao>
          )}

          {podeTratar && (
            <div className="grid gap-2">
              {(status === "emitido" || status === "em_analise") && (
                <Button size="lg" className="gap-2" disabled={ocupado} onClick={() => acao("gerar_versao")}>
                  <FileText className="h-4 w-4" />Gerar versão Regional
                </Button>
              )}
              {status === "aguardando_cmd" && (
                <Button size="lg" variant={pd.devolutiva_decisao ? "outline" : "default"} className="gap-2" onClick={() => {
                  setDev({ decisao: pd.devolutiva_decisao ?? "", acao: pd.devolutiva_acao ?? "", observacoes: pd.devolutiva_observacoes ?? "" });
                  setModal("devolutiva");
                }}>
                  <ClipboardCheck className="h-4 w-4" />{pd.devolutiva_decisao ? "Editar devolutiva" : "Registrar devolutiva"}
                </Button>
              )}
              {status === "aguardando_cmd" && pd.devolutiva_decisao && (
                <Button size="lg" className="gap-2" disabled={ocupado} onClick={concluir}>
                  <CheckCircle2 className="h-4 w-4" />Concluir PD
                </Button>
              )}
              {podeCancelar(status, podeTratar) && (
                <Button size="lg" variant="outline" className="gap-2 text-destructive" onClick={() => { setJustificativa(""); setModal("cancelar"); }}>
                  <Ban className="h-4 w-4" />Cancelar PD
                </Button>
              )}
            </div>
          )}

          <Secao titulo="Linha do tempo" icon={ClipboardCheck}>
            <ol className="space-y-3 border-l-2 border-primary/40 pl-4">
              {(eventos ?? []).map((ev) => (
                <li key={ev.id} className="min-w-0">
                  <p className="break-words text-sm font-medium">{ev.descricao}</p>
                  <p className="text-xs text-muted-foreground">{ev.responsavel_nome ?? "-"} · {formatarDataHoraBR(ev.created_at)}</p>
                </li>
              ))}
            </ol>
          </Secao>
        </div>

        <Dialog open={modal === "devolutiva"} onOpenChange={(o) => !o && setModal(null)}>
          <DialogContent className="w-[98vw] max-w-lg">
            <DialogHeader><DialogTitle>Devolutiva do CMD Regional</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Devolutiva / decisão *</Label><Textarea rows={4} value={dev.decisao} onChange={(e) => setDev({ ...dev, decisao: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ação a ser tomada *</Label><Textarea rows={3} value={dev.acao} onChange={(e) => setDev({ ...dev, acao: e.target.value })} /></div>
              <div className="space-y-1"><Label>Observações</Label><Textarea rows={3} value={dev.observacoes} onChange={(e) => setDev({ ...dev, observacoes: e.target.value })} /></div>
              <Button size="lg" className="w-full" disabled={ocupado} onClick={async () => {
                if (await acao("registrar_devolutiva", dev)) { setModal(null); toast.success("Devolutiva registrada. Agora você pode concluir o PD.", toast6); }
              }}>Salvar devolutiva</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={modal === "cancelar"} onOpenChange={(o) => !o && setModal(null)}>
          <DialogContent className="w-[98vw] max-w-lg">
            <DialogHeader><DialogTitle>Cancelar {numero}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">O PD não será apagado: vai para o Histórico como Cancelado, com a sua justificativa.</p>
              <div className="space-y-1"><Label>Justificativa *</Label><Textarea rows={4} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></div>
              <Button size="lg" variant="destructive" className="w-full" disabled={ocupado || !justificativa.trim()} onClick={async () => {
                if (await acao("cancelar", { justificativa })) { setModal(null); toast.success("PD cancelado", toast6); }
              }}>Confirmar cancelamento</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
