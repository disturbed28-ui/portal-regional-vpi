import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseAniversariantesExcel, AniversariantesParseResult } from '@/lib/aniversariantesParser';
import { useAuth } from '@/hooks/useAuth';

export function AniversariantesUploadCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<AniversariantesParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    atualizados: number;
    naoEncontrados: number;
    naoEncontradosLista: Array<{ nome_colete: string; divisao: string }>;
  } | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);

    try {
      const result = await parseAniversariantesExcel(file);
      setParseResult(result);

      if (result.erros.length > 0 && result.aniversariantes.length === 0) {
        toast({
          title: 'Erro no arquivo',
          description: result.erros[0],
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao processar arquivo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
      setParseResult(null);
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.aniversariantes.length === 0 || !user?.id) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-import-aniversariantes', {
        body: {
          user_id: user.id,
          aniversariantes: parseResult.aniversariantes
        }
      });

      if (error) throw error;

      if (data.success) {
        setImportResult(data.resumo);
        toast({
          title: 'Importação concluída',
          description: `${data.resumo.atualizados} integrantes atualizados`
        });
      } else {
        throw new Error(data.error || 'Erro na importação');
      }
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importar Aniversários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input de arquivo */}
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileSelect}
            className="flex-1"
            disabled={isProcessing}
          />
        </div>

        {/* Preview do arquivo */}
        {parseResult && !importResult && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedFile?.name}</span>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Total de registros: <span className="text-foreground font-medium">{parseResult.stats.totalLinhas}</span></p>
              <p>Válidos para importar: <span className="text-foreground font-medium">{parseResult.stats.validos}</span></p>
              {parseResult.stats.invalidos > 0 && (
                <p className="text-destructive">Inválidos: {parseResult.stats.invalidos}</p>
              )}
              {parseResult.stats.divisoesEncontradas.length > 0 && (
                <p>Divisões: {parseResult.stats.divisoesEncontradas.slice(0, 3).join(', ')}
                  {parseResult.stats.divisoesEncontradas.length > 3 && ` +${parseResult.stats.divisoesEncontradas.length - 3}`}
                </p>
              )}
            </div>

            {parseResult.erros.length > 0 && (
              <div className="text-xs text-destructive mt-2">
                {parseResult.erros.slice(0, 3).map((erro, i) => (
                  <p key={i}>{erro}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleImport}
                disabled={isProcessing || parseResult.stats.validos === 0}
                size="sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Confirmar Importação'
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={isProcessing}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Resultado da importação */}
        {importResult && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Importação concluída
            </div>
            
            <div className="text-sm space-y-1">
              <p className="text-green-600">
                ✓ {importResult.atualizados} integrantes atualizados
              </p>
              {importResult.naoEncontrados > 0 && (
                <div>
                  <p className="text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {importResult.naoEncontrados} não encontrados
                  </p>
                  {importResult.naoEncontradosLista.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                      {importResult.naoEncontradosLista.map((item, i) => (
                        <p key={i}>{item.nome_colete} - {item.divisao}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={handleReset}>
              Nova Importação
            </Button>
          </div>
        )}

        {/* Instruções */}
        {!selectedFile && (
          <p className="text-xs text-muted-foreground">
            Selecione um arquivo Excel (.xls ou .xlsx) contendo as colunas: Nome/Colete, Divisão e Data de Nascimento/Aniversário
          </p>
        )}
      </CardContent>
    </Card>
  );
}
