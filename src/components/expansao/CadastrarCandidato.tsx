import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useExpansaoCandidatos } from "@/hooks/useExpansao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

const notify = (msg: string, error = false) =>
  (error ? toast.error : toast.success)(msg, { duration: 6000, dismissible: false });

// Campos comuns a todas as fichas — obrigatórios
const CAMPOS: { key: string; label: string; required: boolean; full?: boolean }[] = [
  { key: "nome_completo", label: "Nome completo", required: true, full: true },
  { key: "nome_colete", label: "Nome de colete", required: true },
  { key: "telefone", label: "Telefone", required: true },
  { key: "nascimento", label: "Nascimento", required: true },
  { key: "cpf", label: "CPF", required: true },
  { key: "rg", label: "RG", required: false },
  { key: "profissao", label: "Profissão", required: true, full: true },
  { key: "email", label: "Email", required: true, full: true },
  { key: "endereco_rua", label: "Rua", required: true, full: true },
  { key: "endereco_bairro", label: "Bairro", required: true },
  { key: "endereco_cidade", label: "Cidade", required: true },
  { key: "endereco_estado", label: "Estado (UF)", required: false },
  { key: "endereco_cep", label: "CEP", required: true },
  { key: "tamanho_camiseta", label: "Tamanho da camiseta", required: true },
  { key: "colete_tipo", label: "Colete (Couro/Jeans)", required: true },
  { key: "tamanho_colete", label: "Tamanho do colete", required: true },
  { key: "forma_pagamento", label: "Forma de pagamento", required: false },
  { key: "contato_emergencia", label: "Contato de emergência", required: false, full: true },
  { key: "comando_responsavel", label: "Comando responsável", required: false },
  { key: "diretor_regional_responsavel", label: "Diretor Regional responsável", required: false },
];

type FormState = Record<string, string>;

export function CadastrarCandidato() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const regionalId = profile?.regional_id || null;
  const { create } = useExpansaoCandidatos(regionalId);

  const [fichaRaw, setFichaRaw] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [expansaoNome, setExpansaoNome] = useState("");
  const [expansaoTelefone, setExpansaoTelefone] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState("");

  const setField = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleExtract = async () => {
    if (!fichaRaw.trim() && !pdfFile) {
      notify("Cole a ficha ou anexe um PDF primeiro.", true);
      return;
    }
    setExtracting(true);
    try {
      const payload: Record<string, string> = {};
      if (fichaRaw.trim()) payload.ficha_text = fichaRaw.trim();
      if (pdfFile) payload.pdf_base64 = await fileToBase64(pdfFile);

      const { data, error } = await supabase.functions.invoke("expansao-extrair-ficha", {
        body: payload,
      });
      if (error) throw error;
      const dados = (data?.dados ?? {}) as Record<string, unknown>;

      const next: FormState = { ...form };
      Object.entries(dados).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          next[k] = String(v);
        }
      });
      setForm(next);
      if (dados.expansao_nome) setExpansaoNome(String(dados.expansao_nome));
      if (dados.expansao_telefone) setExpansaoTelefone(String(dados.expansao_telefone));
      notify("Dados identificados! Revise e complete antes de salvar.");
    } catch (e) {
      notify("Falha ao identificar dados: " + (e as Error).message, true);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    const faltando = CAMPOS.filter((c) => c.required && !form[c.key]?.trim()).map((c) => c.label);
    if (faltando.length > 0) {
      notify("Preencha os campos obrigatórios: " + faltando.join(", "), true);
      return;
    }
    if (!regionalId) {
      notify("Sua regional não foi identificada.", true);
      return;
    }
    setSaving(true);
    try {
      let anexoPath: string | null = null;
      if (pdfFile) {
        const path = `${regionalId}/${Date.now()}-${pdfFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("expansao-fichas")
          .upload(path, pdfFile, { upsert: false });
        if (!upErr) anexoPath = path;
      }

      await create.mutateAsync({
        status: "pendente",
        ficha_raw: fichaRaw || null,
        dados_extraidos: form as unknown as Record<string, unknown>,
        anexo_path: anexoPath,
        ...Object.fromEntries(CAMPOS.map((c) => [c.key, form[c.key]?.trim() || null])),
        expansao_nome: expansaoNome.trim() || null,
        expansao_telefone: expansaoTelefone.trim() || null,
        data_recebimento: dataRecebimento || null,
        regional_id: regionalId,
        cadastrado_por: user?.id || null,
        cadastrado_por_nome: profile?.nome_colete || null,
      });

      setForm({});
      setFichaRaw("");
      setPdfFile(null);
      setExpansaoNome("");
      setExpansaoTelefone("");
      setDataRecebimento("");
    } catch {
      /* erro tratado no hook */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Ficha recebida da Expansão</Label>
          <Textarea
            placeholder="Cole aqui a ficha recebida do representante da Expansão..."
            value={fichaRaw}
            onChange={(e) => setFichaRaw(e.target.value)}
            className="min-h-[160px]"
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
              <div className="flex items-center justify-center gap-2 h-10 rounded-md border border-dashed border-input cursor-pointer text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {pdfFile ? pdfFile.name : "Anexar ficha em PDF"}
              </div>
            </label>
            <Button onClick={handleExtract} disabled={extracting} className="gap-2">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Identificar dados (IA)
            </Button>
          </div>
          {pdfFile && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> {pdfFile.name}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-sm font-semibold">Dados do candidato</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.key} className={c.full ? "sm:col-span-2" : ""}>
                <Label className="text-xs">
                  {c.label}
                  {c.required && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  value={form[c.key] || ""}
                  onChange={(e) => setField(c.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm font-semibold">Representante da Expansão</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div>
                <Label className="text-xs">Nome do representante</Label>
                <Input value={expansaoNome} onChange={(e) => setExpansaoNome(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefone do representante</Label>
                <Input value={expansaoTelefone} onChange={(e) => setExpansaoTelefone(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data de recebimento</Label>
                <Input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar candidato
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
