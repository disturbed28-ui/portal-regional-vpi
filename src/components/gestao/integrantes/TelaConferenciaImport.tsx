import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  UserPlus, 
  UserMinus, 
  RefreshCw,
  ArrowLeftRight,
  HelpCircle,
  RotateCcw,
  Shield,
  Play
} from "lucide-react";
import { LoteProcessamento, MotivoRemovido } from "@/hooks/useConsolidacaoIntegrantes";
import { ExportarDadosProcessados } from "./ExportarDadosProcessados";
import { ModalMotivoRemovido } from "./ModalMotivoRemovido";

interface TelaConferenciaImportProps {
  lote: LoteProcessamento;
  loading: boolean;
  motivosRemovidos: Map<string, MotivoRemovido>;
  onToggleSelecao: (tipo: 'novos' | 'atualizados' | 'removidos', id: number | string) => void;
  onToggleTodos: (tipo: 'novos' | 'atualizados' | 'removidos', marcar: boolean) => void;
  onToggleModoSimulacao: () => void;
  onDefinirMotivoRemovido: (motivo: MotivoRemovido) => void;
  onExecutarImportacao: () => Promise<boolean>;
  onObterDadosExportacao: () => any[];
  onExportarConsolidacao: () => any[];
  onNovaImportacao: () => void;
  readOnly?: boolean;
}

export function TelaConferenciaImport({
  lote,
  loading,
  motivosRemovidos,
  onToggleSelecao,
  onToggleTodos,
  onToggleModoSimulacao,
  onDefinirMotivoRemovido,
  onExecutarImportacao,
  onObterDadosExportacao,
  onExportarConsolidacao,
  onNovaImportacao,
  readOnly = false
}: TelaConferenciaImportProps) {
  const [modalMotivoAberto, setModalMotivoAberto] = useState(false);
  const [removidoSelecionado, setRemovidoSelecionado] = useState<any>(null);
  
  const delta = lote.delta;
  const consolidacao = lote.consolidacao;
  
  if (!delta || !consolidacao) return null;

  const totalNovos = delta.novos.length;
  const totalAtualizados = delta.atualizados.length;
  const totalRemovidos = delta.removidos.length;
  const totalTransferidos = delta.transferidos.length;
  const totalNaoEncontrados = consolidacao.naoEncontrados.length;
  
  const selecionadosNovos = lote.selecao.novos.size;
  const selecionadosAtualizados = lote.selecao.atualizados.size;
  const selecionadosRemovidos = lote.selecao.removidos.size;
  
  const removidosSemMotivo = delta.removidos
    .filter(r => lote.selecao.removidos.has(r.id) && !motivosRemovidos.has(r.id))
    .length;
  
  const podeConfirmar = !loading && !readOnly && removidosSemMotivo === 0;
  
  const handleAbrirModalMotivo = (removido: any) => {
    setRemovidoSelecionado(removido);
    setModalMotivoAberto(true);
  };

  const handleSalvarMotivo = (motivo: MotivoRemovido) => {
    onDefinirMotivoRemovido(motivo);
    setModalMotivoAberto(false);
    setRemovidoSelecionado(null);
  };

  // Calcular percentual de remoções
  const percentualRemocao = totalRemovidos / (consolidacao.estatisticas.totalArquivoB || 1) * 100;
  const alertaRemocaoMassiva = percentualRemocao > 30;

  return (
    <div className="space-y-4">
      {/* Header com ID do Lote */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Conferência de Importação</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {lote.id}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Revise as alterações antes de confirmar a importação
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Modo e Status */}
      <Card className={`border-border/50 ${lote.modoSimulacao ? 'bg-amber-500/10' : 'bg-destructive/10'}`}>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${lote.modoSimulacao ? 'text-amber-500' : 'text-destructive'}`} />
              <span className="text-sm font-medium">
                {lote.modoSimulacao ? 'MODO SIMULAÇÃO' : 'MODO PRODUÇÃO'}
              </span>
            </div>
            <Switch
              checked={lote.modoSimulacao}
              onCheckedChange={onToggleModoSimulacao}
              disabled={readOnly || lote.etapa === 'concluido'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerta de remoção massiva */}
      {alertaRemocaoMassiva && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção!</strong> {percentualRemocao.toFixed(0)}% dos integrantes seriam removidos. 
            Verifique se os arquivos estão corretos.
          </AlertDescription>
        </Alert>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-border/50">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-green-500">{totalNovos}</div>
            <div className="text-xs text-muted-foreground">Novos</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{totalAtualizados}</div>
            <div className="text-xs text-muted-foreground">Alterados</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-red-500">{totalRemovidos}</div>
            <div className="text-xs text-muted-foreground">Removidos</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{delta.semMudanca}</div>
            <div className="text-xs text-muted-foreground">Sem mudança</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com detalhes */}
      <Tabs defaultValue="novos" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="novos" className="text-xs py-2 relative">
            <UserPlus className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Novos</span>
            {selecionadosNovos > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {selecionadosNovos}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="atualizados" className="text-xs py-2 relative">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Alter.</span>
            {selecionadosAtualizados > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {selecionadosAtualizados}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="removidos" className="text-xs py-2 relative">
            <UserMinus className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Rem.</span>
            {selecionadosRemovidos > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {selecionadosRemovidos}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outros" className="text-xs py-2 relative">
            <HelpCircle className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Outros</span>
          </TabsTrigger>
        </TabsList>

        {/* Novos */}
        <TabsContent value="novos" className="mt-3">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selecionadosNovos}/{totalNovos} selecionados
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('novos', true)}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('novos', false)}
                  >
                    Nenhum
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="h-[300px]">
              <CardContent className="py-2 px-3 space-y-2">
                {delta.novos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum integrante novo detectado
                  </p>
                ) : (
                  delta.novos.map((novo) => (
                    <div
                      key={novo.id_integrante}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={lote.selecao.novos.has(novo.id_integrante)}
                        onCheckedChange={() => onToggleSelecao('novos', novo.id_integrante)}
                        disabled={readOnly}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{novo.nome_colete}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {novo.divisao} • {novo.cargo_grau}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        #{novo.id_integrante}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Atualizados */}
        <TabsContent value="atualizados" className="mt-3">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selecionadosAtualizados}/{totalAtualizados} selecionados
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('atualizados', true)}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('atualizados', false)}
                  >
                    Nenhum
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="h-[300px]">
              <CardContent className="py-2 px-3 space-y-2">
                {delta.atualizados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma alteração detectada
                  </p>
                ) : (
                  delta.atualizados.map((item) => (
                    <div
                      key={item.antigo.id}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={lote.selecao.atualizados.has(item.antigo.id)}
                        onCheckedChange={() => onToggleSelecao('atualizados', item.antigo.id)}
                        disabled={readOnly}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.novo.nome_colete}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.novo.divisao} • {item.novo.cargo_grau}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Removidos */}
        <TabsContent value="removidos" className="mt-3">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selecionadosRemovidos}/{totalRemovidos} selecionados
                  {removidosSemMotivo > 0 && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      {removidosSemMotivo} sem motivo
                    </Badge>
                  )}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('removidos', true)}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onToggleTodos('removidos', false)}
                  >
                    Nenhum
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="h-[300px]">
              <CardContent className="py-2 px-3 space-y-2">
                {delta.removidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum integrante seria removido
                  </p>
                ) : (
                  delta.removidos.map((removido) => {
                    const motivoDefinido = motivosRemovidos.get(removido.id);
                    const selecionado = lote.selecao.removidos.has(removido.id);
                    
                    return (
                      <div
                        key={removido.id}
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selecionado}
                          onCheckedChange={() => onToggleSelecao('removidos', removido.id)}
                          disabled={readOnly}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{removido.nome_colete}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {removido.divisao_texto} • {removido.cargo_grau_texto}
                          </p>
                          {selecionado && (
                            <div className="mt-1">
                              {motivoDefinido ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {motivoDefinido.motivo_inativacao}
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs text-destructive"
                                  onClick={() => handleAbrirModalMotivo(removido)}
                                  disabled={readOnly}
                                >
                                  Definir motivo
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Outros (transferidos e não encontrados) */}
        <TabsContent value="outros" className="mt-3 space-y-3">
          {/* Transferidos */}
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Transferidos ({totalTransferidos})</span>
              </div>
            </CardHeader>
            <ScrollArea className="max-h-[150px]">
              <CardContent className="py-2 px-3 space-y-1">
                {delta.transferidos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma transferência detectada</p>
                ) : (
                  delta.transferidos.map((t) => (
                    <div key={t.integrante.id} className="text-xs p-1">
                      <span className="font-medium">{t.integrante.nome_colete}</span>
                      <span className="text-muted-foreground"> → {t.nova_regional}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </ScrollArea>
          </Card>

          {/* Não encontrados */}
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Não encontrados ({totalNaoEncontrados})</span>
              </div>
            </CardHeader>
            <ScrollArea className="max-h-[150px]">
              <CardContent className="py-2 px-3 space-y-1">
                {consolidacao.naoEncontrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todos os registros foram encontrados</p>
                ) : (
                  consolidacao.naoEncontrados.map((ne, idx) => (
                    <div key={idx} className="text-xs p-1">
                      <span className="font-medium">{ne.nome_colete}</span>
                      <span className="text-muted-foreground"> • {ne.divisao} (linha {ne.linha_original})</span>
                    </div>
                  ))
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ações */}
      <div className="space-y-2">
        {/* Botão para exportar consolidação bruta (A + B) */}
        <ExportarDadosProcessados
          lote={lote}
          dados={onExportarConsolidacao()}
          disabled={loading || !lote.consolidacao}
          label="Exportar Consolidação (A+B)"
        />
        
        {/* Botão para exportar dados selecionados para importação */}
        <ExportarDadosProcessados
          lote={lote}
          dados={onObterDadosExportacao()}
          disabled={loading}
          label="Exportar Selecionados"
        />
        
        {lote.etapa === 'concluido' ? (
          <Button
            className="w-full"
            onClick={onNovaImportacao}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Nova Importação
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={onExecutarImportacao}
            disabled={!podeConfirmar}
            variant={lote.modoSimulacao ? "secondary" : "default"}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Processando...
              </>
            ) : lote.modoSimulacao ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Simular Importação
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Importação
              </>
            )}
          </Button>
        )}
        
        {removidosSemMotivo > 0 && (
          <p className="text-xs text-destructive text-center">
            Defina o motivo para {removidosSemMotivo} integrante(s) a remover
          </p>
        )}
      </div>

      {/* Modal de Motivo */}
      {removidoSelecionado && (
        <ModalMotivoRemovido
          open={modalMotivoAberto}
          onOpenChange={setModalMotivoAberto}
          integrante={removidoSelecionado}
          onConfirmar={handleSalvarMotivo}
        />
      )}
    </div>
  );
}
