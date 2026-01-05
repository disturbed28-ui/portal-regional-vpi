import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMensalidades } from "@/hooks/useMensalidades";
import { parseMensalidadesExcel, formatRef, ParseResult } from "@/lib/mensalidadesParser";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, FileSpreadsheet, History, Info, Upload } from "lucide-react";
import { format } from "date-fns";
import { HistoricoDevedores } from "@/components/admin/HistoricoDevedores";
import { useQueryClient } from "@tanstack/react-query";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";

interface MensalidadesUploadCardProps {
  showTitle?: boolean;
  readOnly?: boolean;
}

export const MensalidadesUploadCard = ({ showTitle = true, readOnly = false }: MensalidadesUploadCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const mensalidadesInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [mensalidadesPreview, setMensalidadesPreview] = useState<ParseResult | null>(null);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  
  const { ultimaCargaInfo } = useMensalidades();

  const handleMensalidadesFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const parseResult = await parseMensalidadesExcel(file);

      if (parseResult.mensalidades.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "O arquivo não contém dados válidos de mensalidades",
          variant: "destructive",
        });
        return;
      }

      setMensalidadesPreview(parseResult);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      if (mensalidadesInputRef.current) {
        mensalidadesInputRef.current.value = '';
      }
    }
  };

  const handleUploadMensalidades = async () => {
    if (!mensalidadesPreview || !user) return;

    try {
      setProcessing(true);

      // Determinar grau do usuário (prioridade: integrante > profile)
      const userGrau = profile?.integrante?.grau || profile?.grau || null;
      const userDivisaoId = profile?.divisao_id || null;
      
      console.log('[MensalidadesUpload] Sending with scope:', { userGrau, userDivisaoId });
      
      const { data, error } = await supabase.functions.invoke('admin-import-mensalidades', {
        body: {
          user_id: user.id,
          mensalidades: mensalidadesPreview.mensalidades,
          user_grau: userGrau,
          user_divisao_id: userDivisaoId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Importação concluída",
        description: data?.message || "Mensalidades importadas com sucesso",
      });

      setMensalidadesPreview(null);
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['mensalidades-ultima-carga-info'] });
      queryClient.invalidateQueries({ queryKey: ['mensalidades-devedores-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['mensalidades-devedores-cronicos'] });
    } catch (error) {
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Card className="border-orange-200 dark:border-orange-900/50">
        {showTitle && (
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              <CardTitle className="text-base sm:text-lg">Mensalidades em Atraso</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Importe o relatório de mensalidades. Liquidações são detectadas automaticamente.
            </CardDescription>
          </CardHeader>
        )}
        <CardContent className={`space-y-4 ${showTitle ? 'px-3 sm:px-6' : 'px-3 sm:px-6 pt-4'}`}>
          {/* Banner de somente leitura */}
          {readOnly && <ReadOnlyBanner className="mb-2" />}

          {/* Upload Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="file"
                accept=".xls,.xlsx"
                ref={mensalidadesInputRef}
                onChange={handleMensalidadesFileSelect}
                className="hidden"
              />
              <Button 
                onClick={() => mensalidadesInputRef.current?.click()}
                disabled={processing || readOnly}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Selecionar Arquivo
              </Button>
              {mensalidadesPreview && !readOnly && (
                <Button 
                  onClick={handleUploadMensalidades}
                  disabled={processing}
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Confirmar
                </Button>
              )}
            </div>

            {/* Preview após seleção */}
            {mensalidadesPreview && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle className="text-sm">Preview da Importação</AlertTitle>
                <AlertDescription className="text-xs">
                  • {mensalidadesPreview.stats.totalValidas} registros válidos<br/>
                  • {mensalidadesPreview.stats.divisoesEncontradas.length} divisões<br/>
                  • Período: {mensalidadesPreview.stats.periodoRef}
                </AlertDescription>
              </Alert>
            )}

            {/* Resumo da última carga */}
            {ultimaCargaInfo && (
              <div className="p-3 sm:p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-foreground text-sm">Última Carga Ativa</h4>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(ultimaCargaInfo.data_carga), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Período</p>
                    <p className="font-medium text-foreground">
                      {formatRef(ultimaCargaInfo.ref_principal)}
                    </p>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowHistoricoDialog(true)}
                  className="mt-2 text-xs"
                >
                  <History className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Ver Histórico Completo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Histórico */}
      <Dialog open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Mensalidades</DialogTitle>
          </DialogHeader>
          <HistoricoDevedores />
        </DialogContent>
      </Dialog>
    </>
  );
};
