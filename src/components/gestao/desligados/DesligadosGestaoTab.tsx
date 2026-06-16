import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, Loader2, UserX } from "lucide-react";
import { parseDesligadosExcel, type DesligadoExcel } from "@/lib/desligadosParser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProfile } from "@/hooks/useProfile";
import { buildEscopoCargaPayload } from "@/lib/escopoCarga";

interface DesligadosGestaoTabProps {
  userId?: string;
  readOnly?: boolean;
}

export const DesligadosGestaoTab = ({ userId, readOnly = false }: DesligadosGestaoTabProps) => {
  const { profile } = useProfile(userId);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DesligadoExcel[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ignorados, setIgnorados] = useState<{ registro_id: number; nome_colete: string; motivo: string }[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setErros([]);
    setPreview([]);
    setIgnorados([]);
    try {
      const result = await parseDesligadosExcel(selectedFile);
      if (result.desligados.length === 0) {
        toast.info("Nenhum desligado detectado no arquivo.");
        setFile(null);
      } else {
        setPreview(result.desligados);
        setErros(result.erros);
        setEstatisticas(result.estatisticas);
        toast.success(`${result.desligados.length} desligados detectados`, { duration: 6000 });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar arquivo");
      setErros([error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) {
      toast.error("Nenhum dado para enviar");
      return;
    }
    setUploading(true);
    setIgnorados([]);
    try {
      const { data, error } = await supabase.functions.invoke("admin-import-desligados", {
        body: {
          desligados: preview,
          observacoes: `Carga via Excel - ${file?.name}`,
          ...buildEscopoCargaPayload(profile),
        },
      });
      if (error) throw error;
      if (data?.sucesso) {
        let msg = `Importação concluída! ${data.inseridos} novos, ${data.atualizados} atualizados`;
        if (data.ignorados_count > 0) msg += `, ${data.ignorados_count} ignorado(s)`;
        toast.success(msg, { duration: 6000 });
        setIgnorados(data.ignorados || []);
        setFile(null);
        setPreview([]);
        setErros([]);
        setEstatisticas(null);
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error: any) {
      console.error("Erro ao importar desligados:", error);
      toast.error(error.message || "Erro ao importar desligados", { duration: 6000 });
    } finally {
      setUploading(false);
    }
  };

  const porDivisao = preview.reduce((acc, d) => {
    (acc[d.divisao_texto] ||= []).push(d);
    return acc;
  }, {} as Record<string, DesligadoExcel[]>);

  return (
    <div className="space-y-6">
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4" /> Atualizar Desligados Definitivos
            </CardTitle>
            <CardDescription>
              Faça upload do Excel do portal com integrantes desligados/afastados definitivamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-desligados-gestao"
                disabled={loading || uploading}
              />
              <label htmlFor="file-upload-desligados-gestao" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo Excel</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando arquivo...
              </div>
            )}

            {erros.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1 text-sm">{erros.length} aviso(s):</div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {erros.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {erros.length > 5 && <li className="text-muted-foreground">... e mais {erros.length - 5}</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {estatisticas && (
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-4 pb-3 px-3">
                  <div className="text-xl font-bold">{estatisticas.total}</div>
                  <p className="text-xs text-muted-foreground">Desligados</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3 px-3">
                  <div className="text-xl font-bold">{Object.keys(estatisticas.porDivisao).length}</div>
                  <p className="text-xs text-muted-foreground">Divisões</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3 px-3">
                  <div className="text-xl font-bold text-destructive">{estatisticas.expulsos}</div>
                  <p className="text-xs text-muted-foreground">Expulsos</p>
                </CardContent></Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview dos Dados</CardTitle>
            <CardDescription>Confira antes de confirmar a importação</CardDescription>
          </CardHeader>
          <CardContent>
            {estatisticas?.datasInferidas > 0 && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {estatisticas.datasInferidas} registro(s) sem data no arquivo — usada a data mais antiga da planilha.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              {Object.entries(porDivisao).map(([divisao, lista]) => (
                <div key={divisao} className="space-y-2">
                  <h3 className="font-semibold text-sm border-b pb-1">{divisao}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-1.5 text-muted-foreground">Nº</th>
                          <th className="text-left p-1.5 text-muted-foreground">Apelido</th>
                          <th className="text-left p-1.5 text-muted-foreground">Cargo</th>
                          <th className="text-left p-1.5 text-muted-foreground">Grau</th>
                          <th className="text-left p-1.5 text-muted-foreground">Tipo</th>
                          <th className="text-left p-1.5 text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((d, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-1.5">{d.registro_id}</td>
                            <td className="p-1.5 font-medium">{d.nome_colete}</td>
                            <td className="p-1.5">{d.cargo_nome || "—"}</td>
                            <td className="p-1.5">{d.grau || "—"}</td>
                            <td className="p-1.5">
                              <Badge variant={d.motivo_inativacao === "expulso" ? "destructive" : "secondary"} className="text-[10px] px-1 py-0">
                                {d.motivo_inativacao === "expulso" ? "Expulso" : "Desligado"}
                              </Badge>
                            </td>
                            <td className="p-1.5">
                              {format(new Date(`${d.data_desligamento}T12:00:00`), "dd/MM/yy", { locale: ptBR })}
                              {d.data_inferida && <span className="text-muted-foreground"> *</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={uploading}
                onClick={() => { setFile(null); setPreview([]); setErros([]); setEstatisticas(null); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando...</> : "Confirmar Importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {ignorados.length > 0 && (
        <Card className="border-amber-400/50">
          <CardHeader>
            <CardTitle className="text-base text-amber-600 dark:text-amber-400">
              {ignorados.length} registro(s) ignorado(s)
            </CardTitle>
            <CardDescription>Os itens abaixo não foram importados pelos motivos indicados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-1.5 text-muted-foreground">Nº</th>
                    <th className="text-left p-1.5 text-muted-foreground">Apelido</th>
                    <th className="text-left p-1.5 text-muted-foreground">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {ignorados.map((ig, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-1.5">{ig.registro_id}</td>
                      <td className="p-1.5 font-medium">{ig.nome_colete}</td>
                      <td className="p-1.5">{ig.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
