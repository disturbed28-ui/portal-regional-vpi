import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ImagePlus, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Interpretacao {
  eh_evento: boolean;
  titulo?: string | null;
  tipo?: string | null;
  time_especial?: string | null;
  escopo?: string | null;
  regional_sigla?: string | null;
  divisao_nome?: string | null;
  data_evento?: string | null;
  hora_inicio?: string | null;
  local?: string | null;
  ponto_encontro?: string | null;
  contato?: string | null;
  descricao?: string | null;
  dias_semana?: string[] | null;
  repetir_ate?: string | null;
}

const DIAS = [
  { v: "MO", l: "Seg" }, { v: "TU", l: "Ter" }, { v: "WE", l: "Qua" },
  { v: "TH", l: "Qui" }, { v: "FR", l: "Sex" }, { v: "SA", l: "Sáb" }, { v: "SU", l: "Dom" },
];

function hojeISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Eventos semanais valem por 3 meses a partir do início, salvo ajuste na revisão
export function repetirAtePadrao(inicio: string): string {
  const [a, m, d] = inicio.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1 + 3, d));
  return dt.toISOString().slice(0, 10);
}

function somarDuasHoras(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const t = (h * 60 + m + 120) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventoCriado: () => void;
}

type Etapa = "entrada" | "revisao" | "sucesso";

const TIPOS = ["Reunião", "Pub", "Ação Social", "Bonde Insano", "Bate e Volta", "Combate", "Coletamento", "Graduação"];
const TIMES = [
  { value: "nenhum", label: "Nenhum (agenda regional)" },
  { value: "caveira", label: "Caveira" },
  { value: "lobo", label: "Lobo" },
  { value: "ursinho", label: "Urso/Ursinho" },
];
const REGIONAIS = [
  { value: "VP1", label: "VP1 - Vale do Paraíba I" },
  { value: "VP2", label: "VP2 - Vale do Paraíba II" },
  { value: "VP3", label: "VP3 - Vale do Paraíba III" },
  { value: "LN", label: "LN - Litoral Norte" },
  { value: "CMD", label: "CMD - Comando" },
];

async function lerErro(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return body?.mensagem || body?.error || error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AdicionarEventoDialog({ open, onOpenChange, onEventoCriado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("entrada");
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [texto, setTexto] = useState("");
  const [flyer, setFlyer] = useState<{ base64: string; mime: string; nome: string } | null>(null);
  const [form, setForm] = useState<Interpretacao | null>(null);
  const [avisoDuplicidade, setAvisoDuplicidade] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ agenda: string; divisao_criada: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetar = () => {
    setEtapa("entrada");
    setTexto("");
    setFlyer(null);
    setForm(null);
    setAvisoDuplicidade(null);
    setResultado(null);
    setProcessando(false);
    setSalvando(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetar();
    onOpenChange(o);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (JPG ou PNG)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 10 MB)");
      return;
    }
    const base64 = await fileToBase64(file);
    setFlyer({ base64, mime: file.type, nome: file.name });
  };

  const interpretar = async () => {
    if (!flyer && !texto.trim()) {
      toast.error("Envie um flyer ou cole o texto do evento");
      return;
    }
    setProcessando(true);
    try {
      const { data, error } = await supabase.functions.invoke("interpretar-flyer", {
        body: {
          imagem_base64: flyer?.base64,
          imagem_mime: flyer?.mime,
          texto: texto.trim() || undefined,
        },
      });
      if (error) throw error;
      const interp = data as Interpretacao;
      if (!interp.eh_evento) {
        toast.error("Este conteúdo não parece ser um evento. Verifique o flyer enviado.");
        return;
      }
      if (interp.dias_semana && interp.dias_semana.length > 0) {
        if (!interp.data_evento) interp.data_evento = hojeISO();
        interp.repetir_ate = repetirAtePadrao(interp.data_evento);
      }
      setForm(interp);
      setEtapa("revisao");
    } catch (err) {
      toast.error(await lerErro(err));
    } finally {
      setProcessando(false);
    }
  };

  const confirmar = async (forcar = false) => {
    if (!form) return;
    if (!form.titulo || !form.data_evento) {
      toast.error("Título e data são obrigatórios");
      return;
    }
    setSalvando(true);
    setAvisoDuplicidade(null);
    try {
      const { data, error } = await supabase.functions.invoke("agenda-criar-evento", {
        body: {
          ...form,
          time_especial: form.time_especial === "nenhum" ? null : form.time_especial,
          flyer_base64: flyer?.base64,
          flyer_mime: flyer?.mime,
          forcar_duplicidade: forcar,
        },
      });
      if (error) throw error;
      setResultado(data);
      setEtapa("sucesso");
      onEventoCriado();
    } catch (err) {
      const msg = await lerErro(err);
      if (msg.includes("Já existe um evento")) {
        setAvisoDuplicidade(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSalvando(false);
    }
  };

  const set = (campo: keyof Interpretacao, valor: string | null) => {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <DialogTitle>
            {etapa === "entrada" && "Adicionar evento"}
            {etapa === "revisao" && "Revisar e confirmar"}
            {etapa === "sucesso" && "Evento cadastrado"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {etapa === "entrada" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {flyer ? (
                  <p className="text-sm font-medium">{flyer.nome}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Toque para anexar o flyer do evento
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              <div className="space-y-1">
                <Label>Ou cole o texto do evento</Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ex.: Pub Insano Divisão SJC Sul, sexta 14/11 às 21h. P.E. às 19h30 no posto..."
                  rows={4}
                />
              </div>

              <Button
                className="w-full"
                onClick={interpretar}
                disabled={processando || (!flyer && !texto.trim())}
              >
                {processando ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Interpretando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Ler flyer / texto</>
                )}
              </Button>
            </div>
          )}

          {etapa === "revisao" && form && (
            <div className="space-y-3">
              {avisoDuplicidade && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>{avisoDuplicidade}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmar(true)}
                      disabled={salvando}
                    >
                      Cadastrar mesmo assim
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label>Título *</Label>
                <Input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={form.tipo || ""} onValueChange={(v) => set("tipo", v)}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Time especial</Label>
                  <Select
                    value={form.time_especial || "nenhum"}
                    onValueChange={(v) => set("time_especial", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Regional</Label>
                  <Select
                    value={form.regional_sigla || ""}
                    onValueChange={(v) => set("regional_sigla", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Regional" /></SelectTrigger>
                    <SelectContent>
                      {REGIONAIS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Divisão</Label>
                  <Input
                    value={form.divisao_nome || ""}
                    onChange={(e) => set("divisao_nome", e.target.value)}
                    placeholder="Ex.: Pindamonhangaba 3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.data_evento || ""}
                    onChange={(e) => set("data_evento", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Horário de início</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio || ""}
                    onChange={(e) => set("hora_inicio", e.target.value)}
                  />
                  {form.hora_inicio && (
                    <p className="text-xs text-muted-foreground">
                      Na agenda: {form.hora_inicio} às {somarDuasHoras(form.hora_inicio)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Repetir toda semana (opcional)</Label>
                <div className="flex flex-wrap gap-1">
                  {DIAS.map((d) => {
                    const ativo = (form.dias_semana || []).includes(d.v);
                    return (
                      <Button
                        key={d.v}
                        type="button"
                        size="sm"
                        variant={ativo ? "default" : "outline"}
                        className="h-8 px-2"
                        onClick={() =>
                          setForm((f) => {
                            if (!f) return f;
                            const atual = f.dias_semana || [];
                            const dias = ativo ? atual.filter((x) => x !== d.v) : [...atual, d.v];
                            return {
                              ...f,
                              dias_semana: dias,
                              repetir_ate: dias.length
                                ? f.repetir_ate || repetirAtePadrao(f.data_evento || hojeISO())
                                : null,
                            };
                          })
                        }
                      >
                        {d.l}
                      </Button>
                    );
                  })}
                </div>
                {(form.dias_semana || []).length > 0 && (
                  <div className="space-y-1">
                    <Label>Repetir até</Label>
                    <Input
                      type="date"
                      value={form.repetir_ate || ""}
                      onChange={(e) => set("repetir_ate", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Padrão de 3 meses. Se mudar, apague o evento e cadastre o flyer novo.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Local / endereço</Label>
                <Input value={form.local || ""} onChange={(e) => set("local", e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Ponto de encontro (P.E.)</Label>
                <Input
                  value={form.ponto_encontro || ""}
                  onChange={(e) => set("ponto_encontro", e.target.value)}
                  placeholder="Ex.: Posto Shell às 19h30"
                />
              </div>

              <div className="space-y-1">
                <Label>Contato / responsável</Label>
                <Input value={form.contato || ""} onChange={(e) => set("contato", e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea
                  value={form.descricao || ""}
                  onChange={(e) => set("descricao", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEtapa("entrada")} disabled={salvando}>
                  Voltar
                </Button>
                <Button className="flex-1" onClick={() => confirmar(false)} disabled={salvando}>
                  {salvando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gravando...</> : "Confirmar e gravar"}
                </Button>
              </div>
            </div>
          )}

          {etapa === "sucesso" && resultado && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <div className="space-y-1">
                <p className="font-medium">Evento gravado na {resultado.agenda}</p>
                {resultado.divisao_criada && (
                  <p className="text-sm text-muted-foreground">
                    A divisão informada não existia e foi cadastrada automaticamente.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  O evento aparecerá na agenda do portal na próxima atualização.
                </p>
              </div>
              <Button className="w-full" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
