import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Calendar } from "lucide-react";
import { parseAfastadosExcel, type AfastadoExcel } from "@/lib/afastadosParser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CargaAfastados = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AfastadoExcel[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setErros([]);
    setPreview([]);

    try {
      const result = await parseAfastadosExcel(selectedFile);
      setPreview(result.afastados);
      setErros(result.erros);
      setEstatisticas(result.estatisticas);

      if (result.erros.length > 0) {
        toast.warning(`Arquivo parseado com ${result.erros.length} avisos`);
      } else {
        toast.success(`${result.afastados.length} afastados detectados`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar arquivo');
      setErros([error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) {
      toast.error('Nenhum dado para enviar');
      return;
    }

    setUploading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-import-afastados', {
        body: {
          afastados: preview,
          observacoes: `Carga via Excel - ${file?.name}`,
        },
      });

      if (error) throw error;

      if (data?.sucesso) {
        // Invalidar cache de pendências
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('pendencias_v2_')) {
            localStorage.removeItem(key);
          }
        });
        
        let message = `Importação concluída! ${data.novos} novos, ${data.atualizados} atualizados`;
        
        if (data.deltasGerados > 0) {
          message += `\n\n⚠️ ${data.deltasGerados} anomalia(s) detectada(s)`;
          
          if (data.deltas && data.deltas.length > 0) {
            message += ':\n';
            data.deltas.forEach((d: any) => {
              const label = d.tipo_delta === 'SUMIU_AFASTADOS' ? '↩️ Saiu dos afastados' : '🆕 Novo afastado';
              message += `• ${label}: ${d.nome_colete}\n`;
            });
          }
          
          message += '\n\nVerifique as pendências no Index.';
        }
        
        toast.success(message, { duration: 8000 });
        
        if (data.avisos && data.avisos.length > 0) {
          console.warn('Avisos:', data.avisos);
        }

        // Limpar
        setFile(null);
        setPreview([]);
        setErros([]);
        setEstatisticas(null);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro ao importar afastados:', error);
      toast.error(error.message || 'Erro ao importar afastados');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (dataRetorno: string) => {
    const hoje = new Date();
    const retorno = new Date(dataRetorno);
    
    if (retorno < hoje) {
      return <Badge variant="destructive">Retorno passou</Badge>;
    }
    
    const dias = Math.ceil((retorno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dias <= 7) {
      return <Badge className="bg-orange-500">Retorna em {dias}d</Badge>;
    } else if (dias <= 30) {
      return <Badge className="bg-yellow-500">Retorna em {dias}d</Badge>;
    } else {
      return <Badge variant="secondary">Retorna em {dias}d</Badge>;
    }
  };

  // Agrupar por divisão
  const afastadosPorDivisao = preview.reduce((acc, afastado) => {
    if (!acc[afastado.divisao_texto]) {
      acc[afastado.divisao_texto] = [];
    }
    acc[afastado.divisao_texto].push(afastado);
    return acc;
  }, {} as Record<string, AfastadoExcel[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova Carga de Afastados</CardTitle>
          <CardDescription>
            Faça upload de um arquivo Excel com integrantes temporariamente afastados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={loading || uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-12 w-12 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Clique para selecionar ou arraste um arquivo Excel
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>

          {erros.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">{erros.length} erro(s) encontrado(s):</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {erros.slice(0, 5).map((erro, idx) => (
                    <li key={idx}>{erro}</li>
                  ))}
                  {erros.length > 5 && (
                    <li className="text-muted-foreground">... e mais {erros.length - 5} erros</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {estatisticas && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{estatisticas.total}</div>
                  <p className="text-sm text-muted-foreground">Total de Afastados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{Object.keys(estatisticas.porDivisao).length}</div>
                  <p className="text-sm text-muted-foreground">Divisões Afetadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-500">{estatisticas.retornosProximos}</div>
                  <p className="text-sm text-muted-foreground">Retornos em 30 dias</p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              Confira os dados antes de confirmar a importação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(afastadosPorDivisao).map(([divisao, afastados]) => (
                <div key={divisao} className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">{divisao}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">Número</th>
                          <th className="text-left p-2">Apelido</th>
                          <th className="text-left p-2">Cargo/Função</th>
                          <th className="text-left p-2">Tipo</th>
                          <th className="text-left p-2">Dt. Afast.</th>
                          <th className="text-left p-2">Dt. Retorno</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {afastados.map((afastado, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">{afastado.registro_id}</td>
                            <td className="p-2 font-medium">{afastado.nome_colete}</td>
                            <td className="p-2">{afastado.cargo_grau_texto || '-'}</td>
                            <td className="p-2">{afastado.tipo_afastamento}</td>
                            <td className="p-2">
                              {format(new Date(afastado.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                            </td>
                            <td className="p-2">
                              {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                            </td>
                            <td className="p-2">{getStatusBadge(afastado.data_retorno_prevista)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setErros([]);
                  setEstatisticas(null);
                }}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={uploading || erros.length > 0}>
                {uploading ? 'Carregando...' : 'Confirmar Importação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
