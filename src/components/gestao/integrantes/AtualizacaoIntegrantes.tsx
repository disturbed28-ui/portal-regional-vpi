import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { 
  Upload, 
  FileSpreadsheet, 
  Play, 
  AlertTriangle, 
  CheckCircle2,
  RotateCcw,
  Shield
} from "lucide-react";
import { useConsolidacaoIntegrantes } from "@/hooks/useConsolidacaoIntegrantes";
import { TelaConferenciaImport } from "./TelaConferenciaImport";

interface AtualizacaoIntegrantesProps {
  userId?: string;
  readOnly?: boolean;
}

export function AtualizacaoIntegrantes({ userId, readOnly = false }: AtualizacaoIntegrantesProps) {
  const [arquivoA, setArquivoA] = useState<File | null>(null);
  const [arquivoB, setArquivoB] = useState<File | null>(null);
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  
  const {
    lote,
    loading,
    motivosRemovidos,
    processarArquivos,
    toggleSelecao,
    toggleTodos,
    toggleModoSimulacao,
    definirMotivoRemovido,
    executarImportacao,
    obterDadosExportacao,
    resetar
  } = useConsolidacaoIntegrantes(userId);

  const handleFileA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivoA(file);
    }
  };

  const handleFileB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivoB(file);
    }
  };

  const handleProcessar = async () => {
    if (!arquivoA || !arquivoB) return;
    await processarArquivos(arquivoA, arquivoB);
  };

  const handleNovaImportacao = () => {
    setArquivoA(null);
    setArquivoB(null);
    if (inputARef.current) inputARef.current.value = '';
    if (inputBRef.current) inputBRef.current.value = '';
    resetar();
  };

  // Se está na etapa de conferência, mostrar tela de conferência
  if (lote.etapa === 'conferencia' || lote.etapa === 'concluido') {
    return (
      <TelaConferenciaImport
        lote={lote}
        loading={loading}
        motivosRemovidos={motivosRemovidos}
        onToggleSelecao={toggleSelecao}
        onToggleTodos={toggleTodos}
        onToggleModoSimulacao={toggleModoSimulacao}
        onDefinirMotivoRemovido={definirMotivoRemovido}
        onExecutarImportacao={executarImportacao}
        onObterDadosExportacao={obterDadosExportacao}
        onNovaImportacao={handleNovaImportacao}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && <ReadOnlyBanner />}
      
      {/* Header com informações */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Atualização de Integrantes</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Consolidação e importação de dados a partir dos arquivos A (hierarquia) e B (dados completos)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Upload Arquivo A */}
      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Arquivo A (Hierarquia)</Label>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Arquivo contendo IDs, nomes e datas de admissão organizados por regional/divisão
          </p>
          
          <div className="flex items-center gap-2">
            <input
              ref={inputARef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileA}
              className="hidden"
              id="arquivo-a"
              disabled={readOnly || loading}
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => inputARef.current?.click()}
              disabled={readOnly || loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {arquivoA ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </Button>
          </div>
          
          {arquivoA && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="truncate">{arquivoA.name}</span>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {(arquivoA.size / 1024).toFixed(0)} KB
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Arquivo B */}
      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Arquivo B (Dados Completos)</Label>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Arquivo contendo todos os dados dos integrantes (sem IDs e datas de admissão)
          </p>
          
          <div className="flex items-center gap-2">
            <input
              ref={inputBRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileB}
              className="hidden"
              id="arquivo-b"
              disabled={readOnly || loading}
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => inputBRef.current?.click()}
              disabled={readOnly || loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {arquivoB ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </Button>
          </div>
          
          {arquivoB && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="truncate">{arquivoB.name}</span>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {(arquivoB.size / 1024).toFixed(0)} KB
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modo Simulação */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                Modo Simulação
              </Label>
              <p className="text-xs text-muted-foreground">
                Processa tudo mas não grava no banco
              </p>
            </div>
            <Switch
              checked={lote.modoSimulacao}
              onCheckedChange={toggleModoSimulacao}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerta de ambiente produtivo */}
      {!lote.modoSimulacao && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção!</strong> O modo simulação está desativado. As alterações serão gravadas no banco de dados.
          </AlertDescription>
        </Alert>
      )}

      {/* Botão de Processamento */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="lg"
          onClick={handleProcessar}
          disabled={!arquivoA || !arquivoB || loading || readOnly}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Processando...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Processamento
            </>
          )}
        </Button>
        
        {(arquivoA || arquivoB) && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleNovaImportacao}
            disabled={loading}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Instruções */}
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Faça upload do <strong>Arquivo A</strong> (hierarquia com IDs)</li>
            <li>Faça upload do <strong>Arquivo B</strong> (dados completos)</li>
            <li>O sistema consolida os arquivos automaticamente</li>
            <li>Revise as alterações detectadas linha a linha</li>
            <li>Exporte os dados para validação externa se necessário</li>
            <li>Confirme a importação quando estiver seguro</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
