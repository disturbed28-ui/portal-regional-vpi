import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Envolvido } from "@/lib/processoDisciplinar";

export interface PdConteudo {
  titulo: string;
  envolvidos: Envolvido[];
  local: string;
  data_ocorrencia: string;
  hora_ocorrencia: string;
  descricao: string;
  houve_conciliacao: boolean | null;
  conciliacao_descricao: string;
}

export const conteudoVazio = (): PdConteudo => ({
  titulo: "", envolvidos: [], local: "", data_ocorrencia: "", hora_ocorrencia: "",
  descricao: "", houve_conciliacao: null, conciliacao_descricao: "",
});

export function errosConteudo(c: PdConteudo): string[] {
  const e: string[] = [];
  if (!c.titulo.trim()) e.push("Título");
  if (c.envolvidos.length === 0) e.push("Envolvido(s)");
  if (!c.local.trim()) e.push("Local");
  if (!c.data_ocorrencia) e.push("Data");
  if (!c.descricao.trim()) e.push("Descrição");
  if (c.houve_conciliacao === null) e.push("Tentativa de conciliação");
  if (c.houve_conciliacao && !c.conciliacao_descricao.trim()) e.push("Descrição da conciliação");
  return e;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label} <span className="text-destructive">*</span></Label>
      {children}
    </div>
  );
}

function BuscaEnvolvidos({ valor, onChange }: { valor: Envolvido[]; onChange: (v: Envolvido[]) => void }) {
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<Envolvido[]>([]);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) { setRes([]); return; }
    const h = setTimeout(async () => {
      const ascii = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const { data } = await supabase
        .from("integrantes_portal")
        .select("id, registro_id, nome_colete, divisao_texto")
        .eq("ativo", true)
        .or(`nome_colete.ilike.%${t}%,nome_colete_ascii.ilike.%${ascii}%`)
        .order("nome_colete")
        .limit(10);
      setRes((data ?? []).map((d: any) => ({
        integrante_id: d.id, id_clube: d.registro_id, nome_colete: d.nome_colete, divisao: d.divisao_texto,
      } as any)));
    }, 300);
    return () => clearTimeout(h);
  }, [termo]);

  const ids = new Set(valor.map((v) => v.integrante_id));
  return (
    <div className="space-y-2">
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {valor.map((v) => (
            <Badge key={String(v.integrante_id)} variant="secondary" className="gap-1 py-1 text-sm">
              <span className="break-words">{v.nome_colete}{v.id_clube ? ` · ${v.id_clube}` : ""}</span>
              <button type="button" aria-label={`Remover ${v.nome_colete}`} onClick={() => onChange(valor.filter((x) => x.integrante_id !== v.integrante_id))}>
                <X className="h-4 w-4" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome de colete" value={termo} onChange={(e) => setTermo(e.target.value)} />
      </div>
      {res.length > 0 && (
        <div className="divide-y rounded-md border">
          {res.filter((r) => !ids.has(r.integrante_id)).map((r: any) => (
            <button key={r.integrante_id} type="button" className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
              onClick={() => { onChange([...valor, { integrante_id: r.integrante_id, id_clube: r.id_clube, nome_colete: r.nome_colete }]); setTermo(""); }}>
              <span className="font-medium">{r.nome_colete}</span>
              <span className="text-xs text-muted-foreground break-words">ID {r.id_clube} · {r.divisao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PdConteudoForm({ valor, onChange }: { valor: PdConteudo; onChange: (v: PdConteudo) => void }) {
  const set = <K extends keyof PdConteudo>(k: K, v: PdConteudo[K]) => onChange({ ...valor, [k]: v });
  return (
    <div className="space-y-4">
      <Campo label="Título da ocorrência">
        <Input maxLength={150} value={valor.titulo} onChange={(e) => set("titulo", e.target.value)} />
      </Campo>
      <Campo label="Envolvido(s)">
        <BuscaEnvolvidos valor={valor.envolvidos} onChange={(v) => set("envolvidos", v)} />
      </Campo>
      <Campo label="Local da ocorrência">
        <Input maxLength={200} value={valor.local} onChange={(e) => set("local", e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Data"><Input type="date" value={valor.data_ocorrencia} onChange={(e) => set("data_ocorrencia", e.target.value)} /></Campo>
        <div className="space-y-1">
          <Label className="text-sm">Hora</Label>
          <Input type="time" value={valor.hora_ocorrencia} onChange={(e) => set("hora_ocorrencia", e.target.value)} />
        </div>
      </div>
      <Campo label="Descrição detalhada da ocorrência">
        <Textarea rows={7} maxLength={8000} value={valor.descricao} onChange={(e) => set("descricao", e.target.value)} />
      </Campo>
      <Campo label="Houve tentativa de conciliação?">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="lg" variant={valor.houve_conciliacao === true ? "default" : "outline"} onClick={() => set("houve_conciliacao", true)}>Sim</Button>
          <Button type="button" size="lg" variant={valor.houve_conciliacao === false ? "default" : "outline"} onClick={() => onChange({ ...valor, houve_conciliacao: false, conciliacao_descricao: "" })}>Não</Button>
        </div>
      </Campo>
      {valor.houve_conciliacao && (
        <Campo label="Descreva a tentativa de conciliação">
          <Textarea rows={4} maxLength={4000} value={valor.conciliacao_descricao} onChange={(e) => set("conciliacao_descricao", e.target.value)} />
        </Campo>
      )}
    </div>
  );
}
