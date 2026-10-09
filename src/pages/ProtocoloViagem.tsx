import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bike, Car, Lock, MapPin, MessageCircle, Phone, Plus, User, X, CalendarDays,
  MoreHorizontal, Info, Route, Pencil, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buildWaMeLink, formatPhoneBR, logEnvioWhatsApp } from "@/lib/whatsapp";
import {
  LABEL_DESTINATARIO, montarMensagemProtocolo, resolverDestinatario, formatarDataBR,
  type MeioTransporte,
} from "@/lib/protocoloViagem";

interface FormState {
  id: string | null;
  cidade_origem: string;
  cidade_destino: string;
  paradas: string[];
  data_saida: string;
  hora_saida: string;
  data_retorno: string;
  hora_retorno: string;
  meio_transporte: MeioTransporte | null;
  meio_transporte_outro: string;
  acompanhado: boolean | null;
  com_cores: boolean | null;
  telefone: string;
}

const vazio = (tel = ""): FormState => ({
  id: null, cidade_origem: "", cidade_destino: "", paradas: [""],
  data_saida: "", hora_saida: "", data_retorno: "", hora_retorno: "",
  meio_transporte: null, meio_transporte_outro: "", acompanhado: null, com_cores: null, telefone: tel,
});

function Secao({ icon: Icon, titulo, children }: { icon: any; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-primary">
        <Icon className="h-5 w-5" /> {titulo}
      </h2>
      {children}
    </Card>
  );
}

function Campo({ label, obrigatorio, children }: { label: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">
        {label} {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Travado({ valor }: { valor: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
      <span className="break-words">{valor || "-"}</span>
      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function Opcao({ ativo, onClick, children, className }: { ativo: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Button type="button" variant={ativo ? "default" : "outline"} onClick={onClick} className={cn("gap-2", className)}>
      {children}
    </Button>
  );
}

const ProtocoloViagem = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [aba, setAba] = useState("registrar");
  const [form, setForm] = useState<FormState>(vazio());
  const [enviando, setEnviando] = useState(false);

  const { data: integrante } = useQuery({
    queryKey: ["protocolo-integrante", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("integrantes_portal")
        .select("id, nome_colete, grau, cargo_nome, cargo_grau_texto, divisao_id, regional_id, divisao_texto, regional_texto")
        .eq("profile_id", user!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.telefone && !form.telefone && !form.id) setForm((f) => ({ ...f, telefone: profile.telefone! }));
  }, [profile?.telefone]); // eslint-disable-line react-hooks/exhaustive-deps

  const dadosIntegrante = {
    integrante_id: integrante?.id ?? null,
    nome_colete: integrante?.nome_colete || profile?.nome_colete || "",
    grau_texto: integrante?.grau
      ? `${integrante.grau}${integrante.cargo_nome ? ` (${integrante.cargo_nome})` : ""}`
      : profile?.grau || "",
    cargo: integrante?.cargo_grau_texto ?? profile?.cargo ?? null,
    divisao_id: integrante?.divisao_id ?? profile?.divisao_id ?? null,
    regional_id: integrante?.regional_id ?? profile?.regional_id ?? null,
    divisao_texto: integrante?.divisao_texto || profile?.divisao || "",
    regional_texto: integrante?.regional_texto || profile?.regional || "",
  };

  const { data: destinatario, isLoading: carregandoDest } = useQuery({
    queryKey: ["protocolo-destinatario", dadosIntegrante.cargo, dadosIntegrante.divisao_id, dadosIntegrante.regional_id, integrante?.grau],
    enabled: !!(dadosIntegrante.divisao_id || dadosIntegrante.regional_id),
    queryFn: () =>
      resolverDestinatario({
        cargo: dadosIntegrante.cargo,
        divisaoId: dadosIntegrante.divisao_id,
        regionalId: dadosIntegrante.regional_id,
        integranteId: dadosIntegrante.integrante_id,
        grau: integrante?.grau ?? null,
      }),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const erros = useMemo(() => {
    const e: string[] = [];
    if (!dadosIntegrante.nome_colete) e.push("Nome de colete não encontrado no seu cadastro");
    if (!form.cidade_origem.trim()) e.push("Cidade de origem");
    if (!form.cidade_destino.trim()) e.push("Cidade de destino");
    if (!form.data_saida || !form.hora_saida) e.push("Data e hora de saída");
    if (!form.data_retorno || !form.hora_retorno) e.push("Previsão e hora de retorno");
    if (form.data_saida && form.hora_saida && form.data_retorno && form.hora_retorno &&
        `${form.data_retorno}T${form.hora_retorno}` < `${form.data_saida}T${form.hora_saida}`)
      e.push("O retorno não pode ser antes da saída");
    if (!form.meio_transporte) e.push("Está viajando de");
    if (form.meio_transporte === "outros" && !form.meio_transporte_outro.trim()) e.push("Informe o meio de transporte em Outros");
    if (form.acompanhado === null) e.push("Acompanhado");
    if (form.com_cores === null) e.push("Com as Cores");
    if (!formatPhoneBR(form.telefone) || form.telefone.replace(/\D/g, "").length < 10) e.push("Telefone / WhatsApp");
    return e;
  }, [form, dadosIntegrante.nome_colete]);

  const handleEnviar = async () => {
    if (erros.length) {
      toast.error("Preencha: " + erros.join(", "), { duration: 6000, dismissible: false });
      return;
    }
    if (!destinatario?.telefone || !user) return;

    const paradas = form.paradas.map((p) => p.trim()).filter(Boolean);
    const mensagem = montarMensagemProtocolo({
      ...dadosIntegrante,
      cidade_origem: form.cidade_origem.trim(),
      cidade_destino: form.cidade_destino.trim(),
      paradas,
      data_saida: form.data_saida, hora_saida: form.hora_saida,
      data_retorno: form.data_retorno, hora_retorno: form.hora_retorno,
      meio_transporte: form.meio_transporte!,
      meio_transporte_outro: form.meio_transporte_outro,
      acompanhado: !!form.acompanhado, com_cores: !!form.com_cores,
      telefone: form.telefone,
    });
    const link = buildWaMeLink(destinatario.telefone, form.id ? `✏️ *PROTOCOLO ATUALIZADO*\n\n${mensagem}` : mensagem);
    if (!link) return;

    // Abre o WhatsApp primeiro (evita bloqueio de pop-up), depois registra.
    const a = document.createElement("a");
    a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();

    setEnviando(true);
    const registro = {
      autor_profile_id: user.id,
      integrante_id: dadosIntegrante.integrante_id,
      nome_colete: dadosIntegrante.nome_colete,
      grau_texto: dadosIntegrante.grau_texto,
      divisao_id: dadosIntegrante.divisao_id,
      divisao_texto: dadosIntegrante.divisao_texto,
      regional_id: dadosIntegrante.regional_id,
      regional_texto: dadosIntegrante.regional_texto,
      cidade_origem: form.cidade_origem.trim(),
      cidade_destino: form.cidade_destino.trim(),
      paradas,
      data_saida: form.data_saida, hora_saida: form.hora_saida,
      data_retorno: form.data_retorno, hora_retorno: form.hora_retorno,
      meio_transporte: form.meio_transporte!,
      meio_transporte_outro: form.meio_transporte === "outros" ? form.meio_transporte_outro.trim() : null,
      acompanhado: !!form.acompanhado, com_cores: !!form.com_cores,
      telefone: form.telefone,
      destinatario_nome: destinatario.nome,
      destinatario_cargo: LABEL_DESTINATARIO[destinatario.tipo],
      destinatario_telefone: destinatario.telefone,
      mensagem,
      status: "enviado",
    };
    const { error } = form.id
      ? await supabase.from("protocolos_viagem").update(registro).eq("id", form.id)
      : await supabase.from("protocolos_viagem").insert(registro);
    setEnviando(false);

    if (error) {
      toast.error("WhatsApp aberto, mas não foi possível salvar no histórico: " + error.message, { duration: 6000, dismissible: false });
      return;
    }
    logEnvioWhatsApp({
      remetente_profile_id: user.id,
      remetente_nome: dadosIntegrante.nome_colete,
      destinatario_profile_id: destinatario.profileId,
      destinatario_nome: destinatario.nome,
      destinatario_telefone: destinatario.telefone,
      template_chave: "protocolo_viagem",
      template_titulo: "Protocolo de Viagem",
      mensagem_renderizada: mensagem,
      modulo_origem: "protocolo_viagem",
      regional_id: dadosIntegrante.regional_id,
      divisao_id: dadosIntegrante.divisao_id,
    });
    toast.success(form.id ? "Protocolo atualizado e salvo no histórico" : "Protocolo salvo no histórico", { duration: 6000, dismissible: false });
    qc.invalidateQueries({ queryKey: ["protocolos-viagem"] });
    setForm(vazio(form.telefone));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-3 py-3">
        <header className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/formularios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold leading-tight">
              <Route className="h-5 w-5 text-primary" /> Protocolo de Viagem
            </h1>
            <p className="text-xs text-muted-foreground">Cadastro de deslocamento do integrante</p>
          </div>
        </header>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="mb-3 grid w-full grid-cols-2">
            <TabsTrigger value="registrar" className="text-xs">{form.id ? "Editando" : "Registrar"}</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="registrar" className="space-y-3">
            {form.id && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                <span>Editando protocolo já enviado. Ao enviar, a versão atualizada vai para o responsável.</span>
                <Button size="sm" variant="ghost" onClick={() => setForm(vazio(form.telefone))}>Cancelar</Button>
              </div>
            )}

            <Secao icon={User} titulo="Dados do Integrante">
              <Campo label="Nome de Colete"><Travado valor={dadosIntegrante.nome_colete} /></Campo>
              <Campo label="Grau"><Travado valor={dadosIntegrante.grau_texto} /></Campo>
              <Campo label="Divisão"><Travado valor={dadosIntegrante.divisao_texto} /></Campo>
              <Campo label="Regional"><Travado valor={dadosIntegrante.regional_texto} /></Campo>
            </Secao>

            <Secao icon={MapPin} titulo="Rota">
              <Campo label="Cidade de origem" obrigatorio>
                <Input maxLength={80} placeholder="Ex.: São José dos Campos" value={form.cidade_origem} onChange={(e) => set("cidade_origem", e.target.value)} />
              </Campo>
              <Campo label="Cidade de destino" obrigatorio>
                <Input maxLength={80} placeholder="Ex.: Rio de Janeiro" value={form.cidade_destino} onChange={(e) => set("cidade_destino", e.target.value)} />
              </Campo>
              {form.paradas.map((p, i) => (
                <Campo key={i} label={`${i + 1}ª cidade de parada`}>
                  <div className="flex gap-2">
                    <Input
                      maxLength={80}
                      placeholder="Opcional"
                      value={p}
                      onChange={(e) => set("paradas", form.paradas.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {i === form.paradas.length - 1 && form.paradas.length < 10 ? (
                      <Button type="button" size="icon" variant="outline" className="shrink-0" aria-label="Adicionar parada"
                        onClick={() => set("paradas", [...form.paradas, ""])}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {form.paradas.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label="Remover parada"
                        onClick={() => set("paradas", form.paradas.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Campo>
              ))}
            </Secao>

            <Secao icon={CalendarDays} titulo="Viagem">
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Data de saída" obrigatorio><Input type="date" value={form.data_saida} onChange={(e) => set("data_saida", e.target.value)} /></Campo>
                <Campo label="Hora" obrigatorio><Input type="time" value={form.hora_saida} onChange={(e) => set("hora_saida", e.target.value)} /></Campo>
                <Campo label="Previsão de retorno" obrigatorio><Input type="date" value={form.data_retorno} onChange={(e) => set("data_retorno", e.target.value)} /></Campo>
                <Campo label="Hora" obrigatorio><Input type="time" value={form.hora_retorno} onChange={(e) => set("hora_retorno", e.target.value)} /></Campo>
              </div>
            </Secao>

            <Secao icon={Bike} titulo="Deslocamento">
              <Campo label="Está viajando de" obrigatorio>
                <div className="grid grid-cols-3 gap-2">
                  <Opcao ativo={form.meio_transporte === "moto"} onClick={() => set("meio_transporte", "moto")}><Bike className="h-4 w-4" />Moto</Opcao>
                  <Opcao ativo={form.meio_transporte === "carro"} onClick={() => set("meio_transporte", "carro")}><Car className="h-4 w-4" />Carro</Opcao>
                  <Opcao ativo={form.meio_transporte === "outros"} onClick={() => set("meio_transporte", "outros")}><MoreHorizontal className="h-4 w-4" />Outros</Opcao>
                </div>
              </Campo>
              {form.meio_transporte === "outros" && (
                <Input maxLength={60} placeholder="Qual? Ex.: ônibus, avião" value={form.meio_transporte_outro} onChange={(e) => set("meio_transporte_outro", e.target.value)} />
              )}
              <Campo label="Acompanhado" obrigatorio>
                <div className="grid grid-cols-2 gap-2">
                  <Opcao ativo={form.acompanhado === true} onClick={() => set("acompanhado", true)}>Sim</Opcao>
                  <Opcao ativo={form.acompanhado === false} onClick={() => set("acompanhado", false)}>Não</Opcao>
                </div>
              </Campo>
              <Campo label="Com as Cores" obrigatorio>
                <div className="grid grid-cols-2 gap-2">
                  <Opcao ativo={form.com_cores === true} onClick={() => set("com_cores", true)}>Sim</Opcao>
                  <Opcao ativo={form.com_cores === false} onClick={() => set("com_cores", false)}>Não</Opcao>
                </div>
              </Campo>
            </Secao>

            <Secao icon={Phone} titulo="Contato">
              <Campo label="Telefone / WhatsApp" obrigatorio>
                <Input inputMode="tel" maxLength={20} value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
              </Campo>
            </Secao>

            <Card className="space-y-3 border-primary/40 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-primary"><Info className="h-4 w-4" /> Importante</h2>
              {carregandoDest ? (
                <p className="text-sm text-muted-foreground">Localizando responsável...</p>
              ) : destinatario ? (
                <>
                  <p className="text-sm">
                    Ao enviar, o protocolo vai pelo WhatsApp para{" "}
                    <strong>{LABEL_DESTINATARIO[destinatario.tipo]} {destinatario.nome}</strong>.
                  </p>
                  {destinatario.fallback && (
                    <p className="text-xs text-muted-foreground">
                      {LABEL_DESTINATARIO[destinatario.tipoPreferido]} não localizado ou sem telefone — enviando ao {LABEL_DESTINATARIO[destinatario.tipo]}.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-destructive">
                  Não foi possível localizar um responsável com telefone cadastrado para sua divisão/regional. Procure a administração.
                </p>
              )}
              <Button
                type="button"
                className="w-full gap-2"
                disabled={!destinatario?.telefone || enviando}
                onClick={handleEnviar}
              >
                <MessageCircle className="h-4 w-4" /> {form.id ? "Reenviar atualização via WhatsApp" : "Enviar via WhatsApp"}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoProtocolos
              userId={user?.id}
              onEditar={(p) => {
                setForm({
                  id: p.id,
                  cidade_origem: p.cidade_origem, cidade_destino: p.cidade_destino,
                  paradas: p.paradas?.length ? p.paradas : [""],
                  data_saida: p.data_saida, hora_saida: p.hora_saida,
                  data_retorno: p.data_retorno, hora_retorno: p.hora_retorno,
                  meio_transporte: p.meio_transporte as MeioTransporte,
                  meio_transporte_outro: p.meio_transporte_outro ?? "",
                  acompanhado: p.acompanhado, com_cores: p.com_cores, telefone: p.telefone,
                });
                setAba("registrar");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function HistoricoProtocolos({ userId, onEditar }: { userId?: string; onEditar: (p: any) => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [cancelar, setCancelar] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["protocolos-viagem", de, ate],
    queryFn: async () => {
      let q = supabase.from("protocolos_viagem").select("*").order("data_saida", { ascending: false }).limit(500);
      if (de) q = q.gte("data_saida", de);
      if (ate) q = q.lte("data_saida", ate);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = (data ?? []).filter((p) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return [p.nome_colete, p.divisao_texto, p.cidade_destino, p.cidade_origem].some((v) => (v || "").toLowerCase().includes(t));
  });

  const confirmarCancelamento = async () => {
    if (!cancelar) return;
    const { error } = await supabase.from("protocolos_viagem")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() }).eq("id", cancelar.id);
    setCancelar(null);
    if (error) return toast.error("Erro ao cancelar: " + error.message, { duration: 6000, dismissible: false });
    toast.success("Protocolo cancelado", { duration: 6000, dismissible: false });
    qc.invalidateQueries({ queryKey: ["protocolos-viagem"] });
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-2 p-3">
        <Input placeholder="Buscar integrante, divisão ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Saída a partir de" />
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Saída até" />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum protocolo encontrado.</p>
      ) : (
        lista.map((p) => {
          const cancelado = p.status === "cancelado";
          const dono = p.autor_profile_id === userId;
          return (
            <Card key={p.id} className={cn("space-y-2 p-3 text-sm", cancelado && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{p.nome_colete}</p>
                  <p className="break-words text-xs text-muted-foreground">{p.divisao_texto || p.regional_texto}</p>
                </div>
                <Badge variant={cancelado ? "destructive" : "secondary"} className="shrink-0">
                  {cancelado ? "Cancelado" : "Enviado"}
                </Badge>
              </div>
              <p className="break-words">
                {p.cidade_origem} → {[...(p.paradas ?? []), p.cidade_destino].join(" → ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Saída {formatarDataBR(p.data_saida)} {p.hora_saida}h · Retorno {formatarDataBR(p.data_retorno)} {p.hora_retorno}h
              </p>
              <p className="text-xs text-muted-foreground">
                {p.meio_transporte === "outros" ? p.meio_transporte_outro || "Outros" : p.meio_transporte === "moto" ? "Moto" : "Carro"}
                {" · "}Acompanhado: {p.acompanhado ? "Sim" : "Não"} · Cores: {p.com_cores ? "Sim" : "Não"}
              </p>
              <p className="text-xs text-muted-foreground">
                Enviado para {p.destinatario_cargo} {p.destinatario_nome || "-"}
              </p>
              {dono && !cancelado && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => onEditar(p)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setCancelar(p)}>
                    <Ban className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              )}
            </Card>
          );
        })
      )}

      <AlertDialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <AlertDialogContent className="w-[98vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar protocolo?</AlertDialogTitle>
            <AlertDialogDescription>
              Viagem para {cancelar?.cidade_destino} em {cancelar && formatarDataBR(cancelar.data_saida)}. O registro continua no histórico como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCancelamento}>Sim, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProtocoloViagem;
