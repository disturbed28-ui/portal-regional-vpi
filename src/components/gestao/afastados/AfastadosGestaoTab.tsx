import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Calendar, UserCheck, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { parseAfastadosExcel, type AfastadoExcel } from "@/lib/afastadosParser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAfastadosAtivos, useRegistrarRetorno } from "@/hooks/useAfastados";
import { ModalBaixaAfastado } from "@/components/admin/ModalBaixaAfastado";
import type { IntegranteAfastado, MotivoBaixa } from "@/hooks/useAfastados";
import { useProfile } from "@/hooks/useProfile";
import { getNivelAcessoAdmin } from "@/lib/grauUtils";

interface AfastadosGestaoTabProps {
  userId?: string;
  readOnly?: boolean;
}

export const AfastadosGestaoTab = ({ userId, readOnly = false }: AfastadosGestaoTabProps) => {
  const { profile } = useProfile(userId);
  const nivelAcesso = getNivelAcessoAdmin(profile?.grau);

  // Para regional, buscar divisões da regional
  const [divisaoIds, setDivisaoIds] = useState<string[]>([]);

  // Buscar divisões da regional do usuário
  useEffect(() => {
    if (nivelAcesso === 'regional' && profile?.regional_id) {
      supabase
        .from('divisoes')
        .select('id')
        .eq('regional_id', profile.regional_id)
        .then(({ data }) => {
          if (data) setDivisaoIds(data.map(d => d.id));
        });
    }
  }, [nivelAcesso, profile?.regional_id]);

  const { afastados: afastadosAtivos, loading: loadingAtivos, refetch } = useAfastadosAtivos(
    nivelAcesso === 'regional' && divisaoIds.length > 0
      ? { divisaoIds }
      : nivelAcesso === 'divisao' && profile?.divisao_id
        ? { divisaoId: profile.divisao_id }
        : undefined
  );

  const { registrarRetorno } = useRegistrarRetorno();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AfastadoExcel[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Empty file dialog
  const [showEmptyFileDialog, setShowEmptyFileDialog] = useState(false);
  const [emptyFileUploading, setEmptyFileUploading] = useState(false);

  // Baixa modal
  const [selectedAfastado, setSelectedAfastado] = useState<IntegranteAfastado | null>(null);
  const [showBaixaModal, setShowBaixaModal] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setErros([]);
    setPreview([]);

    try {
      const result = await parseAfastadosExcel(selectedFile);
      
      // Se arquivo vazio e há afastados ativos, mostrar diálogo de confirmação
      if (result.afastados.length === 0 && afastadosAtivos.length > 0) {
        setShowEmptyFileDialog(true);
        setLoading(false);
        return;
      }

      if (result.afastados.length === 0 && afastadosAtivos.length === 0) {
        toast.info('Arquivo vazio e não há afastados ativos no sistema.');
        setFile(null);
        setLoading(false);
        return;
      }

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

  const handleEmptyFileConfirm = async () => {
    setEmptyFileUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-import-afastados', {
        body: {
          afastados: [],
          observacoes: `Baixa total via arquivo vazio - ${file?.name}`,
          permitir_vazio: true,
        },
      });

      if (error) throw error;

      if (data?.sucesso) {
        toast.success(
          `Baixa realizada em ${data.baixas_automaticas || 0} afastado(s).`,
          { duration: 6000 }
        );
        refetch();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar baixa');
    } finally {
      setEmptyFileUploading(false);
      setShowEmptyFileDialog(false);
      setFile(null);
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
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('pendencias_v2_')) {
            localStorage.removeItem(key);
          }
        });
        
        let message = `Importação concluída! ${data.novos} novos, ${data.atualizados} atualizados`;
        
        if (data.baixas_automaticas > 0) {
          message += `, ${data.baixas_automaticas} baixa(s) automática(s)`;
        }

        if (data.deltasGerados > 0) {
          message += `\n\n⚠️ ${data.deltasGerados} anomalia(s) detectada(s)`;
        }
        
        toast.success(message, { duration: 8000 });

        setFile(null);
        setPreview([]);
        setErros([]);
        setEstatisticas(null);
        refetch();
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

  const handleBaixa = async (motivo: MotivoBaixa, observacao?: string) => {
    if (!selectedAfastado) return;
    try {
      await registrarRetorno(selectedAfastado.id, { motivo, observacoes: observacao });
      toast.success(`Baixa registrada para ${selectedAfastado.nome_colete}`);
      setShowBaixaModal(false);
      setSelectedAfastado(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar baixa');
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
      return <Badge className="bg-yellow-500 text-black">Retorna em {dias}d</Badge>;
    } else {
      return <Badge variant="secondary">Retorna em {dias}d</Badge>;
    }
  };

  // Agrupar preview por divisão
  const afastadosPorDivisao = preview.reduce((acc, afastado) => {
    if (!acc[afastado.divisao_texto]) {
      acc[afastado.divisao_texto] = [];
    }
    acc[afastado.divisao_texto].push(afastado);
    return acc;
  }, {} as Record<string, AfastadoExcel[]>);

  // Agrupar ativos por divisão
  const ativosPorDivisao = afastadosAtivos.reduce((acc, afastado) => {
    const div = afastado.divisao_texto || 'Sem divisão';
    if (!acc[div]) acc[div] = [];
    acc[div].push(afastado);
    return acc;
  }, {} as Record<string, IntegranteAfastado[]>);

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atualizar Afastados</CardTitle>
            <CardDescription>
              Faça upload do Excel exportado do portal com integrantes afastados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-afastados-gestao"
                disabled={loading || uploading}
              />
              <label htmlFor="file-upload-afastados-gestao" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Clique para selecionar um arquivo Excel
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
                  <div className="font-semibold mb-1 text-sm">{erros.length} erro(s):</div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {erros.slice(0, 5).map((erro, idx) => (
                      <li key={idx}>{erro}</li>
                    ))}
                    {erros.length > 5 && (
                      <li className="text-muted-foreground">... e mais {erros.length - 5}</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {estatisticas && (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="text-xl font-bold">{estatisticas.total}</div>
                    <p className="text-xs text-muted-foreground">Afastados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="text-xl font-bold">{Object.keys(estatisticas.porDivisao).length}</div>
                    <p className="text-xs text-muted-foreground">Divisões</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="text-xl font-bold text-orange-500">{estatisticas.retornosProximos}</div>
                    <p className="text-xs text-muted-foreground">Retornos 30d</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview dos dados do upload */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview dos Dados</CardTitle>
            <CardDescription>Confira antes de confirmar a importação</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Suspensos warning */}
            {preview.some(a => a.suspenso) && (
              <Alert className="mb-4 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-xs">
                  <strong>Atenção:</strong> {preview.filter(a => a.suspenso).length} integrante(s) sem datas no arquivo.
                  Foram marcados como <strong>Suspenso</strong> com prazo padrão de 30 dias.
                  Você pode ajustar os dias abaixo.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {Object.entries(afastadosPorDivisao).map(([divisao, afastados]) => (
                <div key={divisao} className="space-y-2">
                  <h3 className="font-semibold text-sm border-b pb-1">{divisao}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-1.5 text-muted-foreground">Nº</th>
                          <th className="text-left p-1.5 text-muted-foreground">Apelido</th>
                          <th className="text-left p-1.5 text-muted-foreground">Tipo</th>
                          <th className="text-left p-1.5 text-muted-foreground">Afast.</th>
                          <th className="text-left p-1.5 text-muted-foreground">Retorno</th>
                          <th className="text-left p-1.5 text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {afastados.map((afastado, idx) => (
                          <tr key={idx} className={`border-b ${afastado.suspenso ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}>
                            <td className="p-1.5">{afastado.registro_id}</td>
                            <td className="p-1.5 font-medium">
                              {afastado.nome_colete}
                              {afastado.suspenso && (
                                <Badge className="ml-1 bg-orange-500 text-[10px] px-1 py-0">Suspenso</Badge>
                              )}
                            </td>
                            <td className="p-1.5">{afastado.tipo_afastamento}</td>
                            <td className="p-1.5">
                              {format(new Date(afastado.data_afastamento), 'dd/MM', { locale: ptBR })}
                            </td>
                            <td className="p-1.5">
                              {afastado.suspenso ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={afastado.dias_suspensao || 30}
                                    onChange={(e) => {
                                      const dias = parseInt(e.target.value) || 30;
                                      setPreview(prev => prev.map(a => {
                                        if (a.registro_id === afastado.registro_id && a.suspenso) {
                                          const retorno = new Date();
                                          retorno.setDate(retorno.getDate() + dias);
                                          return {
                                            ...a,
                                            dias_suspensao: dias,
                                            data_retorno_prevista: retorno.toISOString().split('T')[0],
                                            observacao_auto: `${a.nome_colete} está suspenso por ${dias} dias`,
                                          };
                                        }
                                        return a;
                                      }));
                                    }}
                                    className="w-12 h-5 text-center text-xs border rounded bg-background"
                                  />
                                  <span className="text-muted-foreground">dias</span>
                                </div>
                              ) : (
                                format(new Date(afastado.data_retorno_prevista), 'dd/MM', { locale: ptBR })
                              )}
                            </td>
                            <td className="p-1.5">{getStatusBadge(afastado.data_retorno_prevista)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
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
              <Button size="sm" onClick={handleUpload} disabled={uploading || erros.length > 0}>
                {uploading ? 'Carregando...' : 'Confirmar Importação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Afastados Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Afastados Ativos ({afastadosAtivos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAtivos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : afastadosAtivos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum integrante afastado no momento.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(ativosPorDivisao).map(([divisao, afastados]) => (
                <div key={divisao} className="space-y-2">
                  <h3 className="font-semibold text-sm border-b pb-1 flex items-center gap-2">
                    {divisao}
                    <Badge variant="outline" className="text-xs">{afastados.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {afastados.map((afastado) => (
                      <div
                        key={afastado.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{afastado.nome_colete}</span>
                            <span className="text-xs text-muted-foreground">#{afastado.registro_id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {afastado.tipo_afastamento}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(afastado.data_afastamento), 'dd/MM/yy')} → {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yy')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {getStatusBadge(afastado.data_retorno_prevista)}
                          {!readOnly && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                setSelectedAfastado(afastado);
                                setShowBaixaModal(true);
                              }}
                            >
                              Baixa
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Baixa Manual */}
      <ModalBaixaAfastado
        open={showBaixaModal}
        onOpenChange={setShowBaixaModal}
        afastado={selectedAfastado}
        onConfirm={handleBaixa}
      />

      {/* Dialog de Arquivo Vazio */}
      <Dialog open={showEmptyFileDialog} onOpenChange={setShowEmptyFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Arquivo sem afastados
            </DialogTitle>
            <DialogDescription>
              O arquivo carregado não contém nenhum integrante afastado, mas existem{' '}
              <span className="font-semibold text-foreground">{afastadosAtivos.length}</span>{' '}
              afastado(s) ativo(s) no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Deseja dar baixa em <strong>todos os {afastadosAtivos.length} afastados ativos</strong>?
              Isso significa que todos retornaram às atividades.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1 text-xs">
                {afastadosAtivos.map(a => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="font-medium">{a.nome_colete}</span>
                    <span className="text-muted-foreground">• {a.divisao_texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmptyFileDialog(false);
                setFile(null);
              }}
              disabled={emptyFileUploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEmptyFileConfirm}
              disabled={emptyFileUploading}
              variant="destructive"
            >
              {emptyFileUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Baixa em Todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
