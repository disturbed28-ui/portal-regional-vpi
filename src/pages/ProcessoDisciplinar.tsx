import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Gavel, Pencil, Send, Filter, MessageCircle, Trash2, CalendarDays, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildWaMeLink } from "@/lib/whatsapp";
import { resolverDestinatario } from "@/lib/protocoloViagem";
import {
  STATUS_LABEL, STATUS_EM_ANDAMENTO, STATUS_HISTORICO, formatarNumeroPD, formatarDataBR, mensagemEmissao,
  type PdStatus, type Envolvido,
} from "@/lib/processoDisciplinar";
import { PdConteudoForm, conteudoVazio, errosConteudo, type PdConteudo } from "@/components/pd/PdConteudoForm";
import { PdConteudoView } from "@/components/pd/PdConteudoView";
import { PdDetalheDialog } from "@/components/pd/PdDetalheDialog";

const toast6 = { duration: 6000, dismissible: false };

function abrirLink(href: string) {
  const a = document.createElement("a");
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a); a.click(); a.remove();
}

function ListaPDs({ pds, onAbrir }: { pds: any[]; onAbrir: (id: string) => void }) {
  const [mostrar, setMostrar] = useState(false);
  const [f, setF] = useState({ texto: "", divisao: "", de: "", ate: "", status: "" });
  const divisoes = useMemo(() => [...new Set(pds.map((p) => p.divisao_texto).filter(Boolean))].sort(), [pds]);
  const statuses = useMemo(() => [...new Set(pds.map((p) => p.status))], [pds]);

  const filtrados = pds.filter((p) => {
    const t = f.texto.trim().toLowerCase();
    if (t) {
      const alvo = [formatarNumeroPD(p.numero, p.ano), p.titulo, ...(p.envolvidos ?? []).map((e: Envolvido) => e.nome_colete)].join(" ").toLowerCase();
      if (!alvo.includes(t)) return false;
    }
    if (f.divisao && p.divisao_texto !== f.divisao) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.de && p.data_ocorrencia < f.de) return false;
    if (f.ate && p.data_ocorrencia > f.ate) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Nº do PD, título ou envolvido" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
        <Button variant={mostrar ? "default" : "outline"} size="icon" className="shrink-0" aria-label="Filtros" onClick={() => setMostrar(!mostrar)}>
          <Filter className="h-4 w-4" />
        </Button>
      </div>
      {mostrar && (
        <Card className="space-y-3 p-3">
          <div className="space-y-1"><Label className="text-xs">Divisão</Label>
            <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={f.divisao} onChange={(e) => setF({ ...f, divisao: e.target.value })}>
              <option value="">Todas</option>{divisoes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label>
            <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">Todos</option>{statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s as PdStatus]}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setF({ texto: "", divisao: "", de: "", ate: "", status: "" })}>Limpar filtros</Button>
        </Card>
      )}
      {filtrados.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum PD encontrado.</p>}
      {filtrados.map((p) => (
        <Card key={p.id} role="button" tabIndex={0} className="min-w-0 cursor-pointer space-y-2 p-3 transition-colors hover:bg-muted/50" onClick={() => onAbrir(p.id)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-primary">{formatarNumeroPD(p.numero, p.ano)}</span>
            <Badge variant={p.status === "cancelado" ? "destructive" : p.status === "concluido" ? "default" : "secondary"} className="text-xs">
              {STATUS_LABEL[p.status as PdStatus]}
            </Badge>
          </div>
          <p className="break-words font-medium">{p.titulo}</p>
          <p className="flex items-start gap-1 break-words text-xs text-muted-foreground"><Users className="mt-0.5 h-3 w-3 shrink-0" />{(p.envolvidos ?? []).map((e: Envolvido) => e.nome_colete).join(", ")}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatarDataBR(p.data_ocorrencia)}</span>
            <span className="flex min-w-0 items-center gap-1 break-words"><MapPin className="h-3 w-3 shrink-0" />{p.local}</span>
          </p>
          <p className="break-words text-xs text-muted-foreground">{p.divisao_texto}</p>
        </Card>
      ))}
    </div>
  );
}

const ProcessoDisciplinar = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [aba, setAba] = useState("novo");
  const [etapa, setEtapa] = useState<"form" | "revisao" | "emitido">("form");
  const [conteudo, setConteudo] = useState<PdConteudo>(conteudoVazio());
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [emitido, setEmitido] = useState<{ numero: string; link: string; destino: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: integrante } = useQuery({
    queryKey: ["pd-integrante", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("integrantes_portal")
        .select("id, nome_colete, divisao_id, regional_id, divisao_texto, regional_texto")
        .eq("profile_id", user!.id).eq("ativo", true).maybeSingle();
      return data;
    },
  });
  const autor = {
    nome: integrante?.nome_colete || profile?.nome_colete || "",
    divisao_id: integrante?.divisao_id ?? profile?.divisao_id ?? null,
    regional_id: integrante?.regional_id ?? profile?.regional_id ?? null,
    divisao_texto: integrante?.divisao_texto || profile?.divisao || "",
    regional_texto: integrante?.regional_texto || profile?.regional || "",
  };

  const { data: pds = [] } = useQuery({
    queryKey: ["pds"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("processos_disciplinares").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rascunhos = pds.filter((p) => p.status === "rascunho" && p.autor_profile_id === user?.id);
  const andamento = pds.filter((p) => STATUS_EM_ANDAMENTO.includes(p.status as PdStatus));
  const historico = pds.filter((p) => STATUS_HISTORICO.includes(p.status as PdStatus));

  const registro = () => ({
    titulo: conteudo.titulo.trim(), envolvidos: conteudo.envolvidos as any, local: conteudo.local.trim(),
    data_ocorrencia: conteudo.data_ocorrencia, hora_ocorrencia: conteudo.hora_ocorrencia || null,
    descricao: conteudo.descricao.trim(), houve_conciliacao: !!conteudo.houve_conciliacao,
    conciliacao_descricao: conteudo.houve_conciliacao ? conteudo.conciliacao_descricao.trim() : null,
  });

  const salvarERevisar = async () => {
    const e = errosConteudo(conteudo);
    if (e.length) { toast.error("Preencha: " + e.join(", "), toast6); return; }
    if (!user) return;
    setOcupado(true);
    const base = { ...registro(), autor_profile_id: user.id, autor_nome: autor.nome, divisao_id: autor.divisao_id,
      divisao_texto: autor.divisao_texto, regional_id: autor.regional_id, regional_texto: autor.regional_texto };
    const res = rascunhoId
      ? await supabase.from("processos_disciplinares").update(registro()).eq("id", rascunhoId).select("id").single()
      : await supabase.from("processos_disciplinares").insert(base).select("id").single();
    setOcupado(false);
    if (res.error) { toast.error("Não foi possível salvar: " + res.error.message, toast6); return; }
    setRascunhoId(res.data.id);
    setEtapa("revisao");
    qc.invalidateQueries({ queryKey: ["pds"] });
    window.scrollTo({ top: 0 });
  };

  const emitir = async () => {
    if (!rascunhoId) return;
    setOcupado(true);
    const { data, error } = await supabase.rpc("pd_acao", { _id: rascunhoId, _acao: "emitir", _dados: {} });
    if (error) { setOcupado(false); toast.error(error.message, toast6); return; }
    const pd: any = data;
    const numero = formatarNumeroPD(pd.numero, pd.ano);
    const msg = mensagemEmissao(numero, autor.nome, autor.divisao_texto || autor.regional_texto, { ...registro(), envolvidos: conteudo.envolvidos });
    const dest = await resolverDestinatario({ cargo: "Operacional Regional", divisaoId: null, regionalId: autor.regional_id, integranteId: integrante?.id ?? null })
      .catch(() => null);
    setOcupado(false);
    const link = (dest?.telefone && buildWaMeLink(dest.telefone, msg)) || `https://wa.me/?text=${encodeURIComponent(msg)}`;
    setEmitido({ numero, link, destino: dest ? `${dest.nome} (Diretor Regional)` : "Diretor Regional (escolha o contato)" });
    setEtapa("emitido");
    setConteudo(conteudoVazio());
    setRascunhoId(null);
    qc.invalidateQueries({ queryKey: ["pds"] });
  };

  const abrirRascunho = (p: any) => {
    setConteudo({
      titulo: p.titulo, envolvidos: p.envolvidos ?? [], local: p.local, data_ocorrencia: p.data_ocorrencia,
      hora_ocorrencia: p.hora_ocorrencia ?? "", descricao: p.descricao, houve_conciliacao: p.houve_conciliacao,
      conciliacao_descricao: p.conciliacao_descricao ?? "",
    });
    setRascunhoId(p.id);
    setEtapa("revisao");
  };

  const descartar = async (id: string) => {
    const { error } = await supabase.from("processos_disciplinares").delete().eq("id", id);
    if (error) { toast.error(error.message, toast6); return; }
    if (id === rascunhoId) { setRascunhoId(null); setConteudo(conteudoVazio()); setEtapa("form"); }
    qc.invalidateQueries({ queryKey: ["pds"] });
    toast.success("Rascunho descartado", toast6);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="mx-auto max-w-2xl px-3 py-3">
        <header className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/formularios")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold leading-tight"><Gavel className="h-5 w-5 text-primary" /> PD – Processo Disciplinar</h1>
            <p className="text-xs text-muted-foreground">Abertura, análise e conclusão</p>
          </div>
        </header>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="mb-3 grid w-full grid-cols-3">
            <TabsTrigger value="novo" className="text-xs">Novo PD</TabsTrigger>
            <TabsTrigger value="andamento" className="text-xs">Em andamento{andamento.length ? ` (${andamento.length})` : ""}</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="novo" className="space-y-3">
            {etapa === "form" && (
              <>
                {rascunhos.length > 0 && (
                  <Card className="space-y-2 p-3">
                    <p className="text-sm font-semibold">Seus rascunhos</p>
                    {rascunhos.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <button className="min-w-0 break-words text-left text-sm underline" onClick={() => abrirRascunho(r)}>{r.titulo}</button>
                        <Button size="icon" variant="ghost" aria-label="Descartar rascunho" onClick={() => descartar(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </Card>
                )}
                <Card className="space-y-1 p-3 text-sm">
                  <p><span className="text-muted-foreground">Emissor:</span> {autor.nome || "-"}</p>
                  <p className="break-words"><span className="text-muted-foreground">Divisão:</span> {autor.divisao_texto || "-"}</p>
                </Card>
                <Card className="p-4"><PdConteudoForm valor={conteudo} onChange={setConteudo} /></Card>
                <Button size="lg" className="w-full" disabled={ocupado} onClick={salvarERevisar}>Salvar e revisar</Button>
              </>
            )}

            {etapa === "revisao" && (
              <>
                <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                  Confira o PD. Depois de emitido, ele recebe o número e não poderá mais ser alterado.
                </div>
                <Card className="p-4"><PdConteudoView c={{ ...conteudo, hora_ocorrencia: conteudo.hora_ocorrencia || null }} /></Card>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="lg" variant="outline" className="gap-2" onClick={() => setEtapa("form")}><Pencil className="h-4 w-4" />Editar</Button>
                  <Button size="lg" className="gap-2" disabled={ocupado} onClick={emitir}><Send className="h-4 w-4" />Emitir PD</Button>
                </div>
              </>
            )}

            {etapa === "emitido" && emitido && (
              <Card className="space-y-3 p-4 text-center">
                <Gavel className="mx-auto h-10 w-10 text-primary" />
                <p className="text-lg font-bold">{emitido.numero} emitido</p>
                <p className="break-words text-sm text-muted-foreground">Envie agora ao {emitido.destino}.</p>
                <Button size="lg" className="w-full gap-2" onClick={() => abrirLink(emitido.link)}><MessageCircle className="h-5 w-5" />Enviar no WhatsApp</Button>
                <Button variant="ghost" className="w-full" onClick={() => { setEmitido(null); setEtapa("form"); }}>Abrir novo PD</Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="andamento"><ListaPDs pds={andamento} onAbrir={setAberto} /></TabsContent>
          <TabsContent value="historico"><ListaPDs pds={historico} onAbrir={setAberto} /></TabsContent>
        </Tabs>
      </div>
      <PdDetalheDialog pdId={aberto} onClose={() => setAberto(null)} />
    </div>
  );
};

export default ProcessoDisciplinar;
