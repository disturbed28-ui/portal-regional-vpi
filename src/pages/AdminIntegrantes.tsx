import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useIntegrantes } from "@/hooks/useIntegrantes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, processDelta, parseCargoGrau } from "@/lib/excelParser";
import { parseMensalidadesExcel, formatRef, ParseResult } from "@/lib/mensalidadesParser";
import { Upload, ArrowLeft, Users, UserCheck, UserX, AlertCircle, FileSpreadsheet, History, Info, RefreshCw } from "lucide-react";
import { HistoricoDevedores } from "@/components/admin/HistoricoDevedores";
import { useMensalidades } from "@/hooks/useMensalidades";
import { format } from "date-fns";
import { DialogAtualizados } from "@/components/admin/DialogAtualizados";
import type { IntegrantePortal } from "@/hooks/useIntegrantes";
import type { ExcelIntegrante } from "@/lib/excelParser";

const AdminIntegrantes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mensalidadesInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  const { integrantes, loading, stats, refetch } = useIntegrantes({ ativo: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [mensalidadesPreview, setMensalidadesPreview] = useState<ParseResult | null>(null);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [ultimaCarga, setUltimaCarga] = useState<{
    id: string;
    data_carga: string;
    total_atualizados: number;
  } | null>(null);
  const [showAtualizadosDialog, setShowAtualizadosDialog] = useState(false);
  
  const { ultimaCargaInfo, devedoresAtivos } = useMensalidades();

  const integrantesFiltrados = integrantes.filter((i) =>
    i.nome_colete.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const excelData = await parseExcelFile(file);
      const delta = processDelta(excelData, integrantes);
      
      setUploadPreview({
        file: file.name,
        delta,
        excelData,
      });
      setShowUploadDialog(true);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyChanges = async () => {
    if (!uploadPreview) return;

    if (!user) {
      toast({
        title: "Erro de autenticacao",
        description: "Usuario nao autenticado",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      const { delta } = uploadPreview;

      // Preparar dados para inserção com validação de cargo_grau
      const novosData = delta.novos
        .filter((item: any) => {
          // Validar campo obrigatório cargo_grau
          if (!item.cargo_grau || item.cargo_grau.trim() === '') {
            console.warn('[AdminIntegrantes] ⚠️ Novo registro sem cargo_grau será ignorado:', {
              id: item.id_integrante,
              nome: item.nome_colete,
              cargo_grau_encontrado: item.cargo_grau
            });
            return false; // Remove do array
          }
          return true;
        })
        .map((item: any) => {
          const { cargo, grau } = parseCargoGrau(item.cargo_grau);
          return {
            registro_id: item.id_integrante,
            nome_colete: item.nome_colete,
            comando_texto: item.comando,
            regional_texto: item.regional,
            divisao_texto: item.divisao,
            cargo_grau_texto: item.cargo_grau,
            cargo_nome: cargo,
            grau: grau,
            ativo: true,
            cargo_estagio: item.cargo_estagio || null,
            sgt_armas: item.sgt_armas || false,
            caveira: item.caveira || false,
            caveira_suplente: item.caveira_suplente || false,
            batedor: item.batedor || false,
            ursinho: item.ursinho || false,
            lobo: item.lobo || false,
            tem_moto: item.tem_moto || false,
            tem_carro: item.tem_carro || false,
            data_entrada: item.data_entrada || null,
          };
        });
      
      // Feedback visual se registros forem filtrados
      if (delta.novos.length !== novosData.length) {
        const ignorados = delta.novos.length - novosData.length;
        toast({
          title: "⚠️ Registros Ignorados",
          description: `${ignorados} novo(s) registro(s) sem cargo foram ignorados. Verifique os logs do console.`,
          variant: "destructive"
        });
      }

      // Preparar dados para atualização com validação de cargo_grau
      const atualizadosData = delta.atualizados
        .filter((item: any) => {
          // Validar campo obrigatório cargo_grau
          if (!item.novo.cargo_grau || item.novo.cargo_grau.trim() === '') {
            console.warn('[AdminIntegrantes] ⚠️ Atualização sem cargo_grau será ignorada:', {
              id: item.antigo.registro_id,
              nome: item.novo.nome_colete,
              cargo_grau_encontrado: item.novo.cargo_grau
            });
            return false; // Remove do array
          }
          return true;
        })
        .map((item: any) => {
          const { cargo, grau } = parseCargoGrau(item.novo.cargo_grau);
          return {
            id: item.antigo.id,
            nome_colete: item.novo.nome_colete,
            comando_texto: item.novo.comando,
            regional_texto: item.novo.regional,
            divisao_texto: item.novo.divisao,
            cargo_grau_texto: item.novo.cargo_grau,
            cargo_nome: cargo,
            grau: grau,
            cargo_estagio: item.novo.cargo_estagio || null,
            sgt_armas: item.novo.sgt_armas || false,
            caveira: item.novo.caveira || false,
            caveira_suplente: item.novo.caveira_suplente || false,
            batedor: item.novo.batedor || false,
            ursinho: item.novo.ursinho || false,
            lobo: item.novo.lobo || false,
            tem_moto: item.novo.tem_moto || false,
            tem_carro: item.novo.tem_carro || false,
            data_entrada: item.novo.data_entrada || null,
          };
        });
      
      // Feedback visual se atualizações forem filtradas
      if (delta.atualizados.length !== atualizadosData.length) {
        const ignorados = delta.atualizados.length - atualizadosData.length;
        toast({
          title: "⚠️ Atualizações Ignoradas",
          description: `${ignorados} atualização(ões) sem cargo foram ignoradas. Verifique os logs do console.`,
          variant: "destructive"
        });
      }

      // Log do payload antes de enviar
      console.log('[AdminIntegrantes] 📤 Payload sendo enviado:', {
        novos_count: novosData.length,
        atualizados_count: atualizadosData.length,
        primeiro_novo: novosData[0],
        primeiro_atualizado: atualizadosData[0],
        todos_novos_tem_cargo_grau: novosData.every((item: any) => item.cargo_grau_texto && item.cargo_grau_texto.trim() !== ''),
        todos_atualizados_tem_cargo_grau: atualizadosData.every((item: any) => item.cargo_grau_texto && item.cargo_grau_texto.trim() !== ''),
        formato_data_entrada_novos: novosData.filter((item: any) => item.data_entrada).map((item: any) => ({ id: item.registro_id, data: item.data_entrada })),
        formato_data_entrada_atualizados: atualizadosData.filter((item: any) => item.data_entrada).slice(0, 3).map((item: any) => ({ id: item.registro_id, data: item.data_entrada }))
      });

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('admin-import-integrantes', {
        body: {
          admin_user_id: user.id,
          novos: novosData,
          atualizados: atualizadosData,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao importar integrantes');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Capturar dados da carga retornados pela Edge Function
      if (data?.carga) {
        setUltimaCarga({
          id: data.carga.id,
          data_carga: data.carga.data_carga,
          total_atualizados: data.carga.total_atualizados,
        });
      }

      toast({
        title: "Importacao concluida",
        description: data?.message || `${delta.novos.length} novos, ${delta.atualizados.length} atualizados`,
      });

      setShowUploadDialog(false);
      setUploadPreview(null);
      refetch();
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: "Erro ao aplicar mudancas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

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
      setMensalidadesPreview(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadMensalidades = async () => {
    if (!mensalidadesPreview || !user) return;

    try {
      setProcessing(true);
      console.log('🚀 Enviando mensalidades para edge function...');
      
      const { data, error } = await supabase.functions.invoke('admin-import-mensalidades', {
        body: {
          user_id: user.id,
          mensalidades: mensalidadesPreview.mensalidades,
          realizado_por: user.user_metadata?.full_name || user.email || 'Admin'
        }
      });

      if (error) {
        toast({
          title: "Erro ao importar mensalidades",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Mensalidades importadas com sucesso!",
        description: `• ${data.insertedCount} registros importados\n• ${data.liquidatedCount} liquidações detectadas\n• Período: ${mensalidadesPreview.stats.periodoRef}`,
      });

      setMensalidadesPreview(null);
      if (mensalidadesInputRef.current) {
        mensalidadesInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('💥 Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Função para comparar campos entre integrante antigo e novo
  const compararCampos = (antigo: IntegrantePortal, novo: ExcelIntegrante) => {
    const alteracoes: Array<{ campo: string; anterior: string; novo: string }> = [];
    
    const campos = [
      { key: 'nome_colete', antigoKey: 'nome_colete', novoKey: 'nome_colete' },
      { key: 'comando_texto', antigoKey: 'comando_texto', novoKey: 'comando' },
      { key: 'regional_texto', antigoKey: 'regional_texto', novoKey: 'regional' },
      { key: 'divisao_texto', antigoKey: 'divisao_texto', novoKey: 'divisao' },
      { key: 'cargo_grau_texto', antigoKey: 'cargo_grau_texto', novoKey: 'cargo_grau' },
      { key: 'cargo_estagio', antigoKey: 'cargo_estagio', novoKey: 'cargo_estagio' },
      { key: 'tem_moto', antigoKey: 'tem_moto', novoKey: 'tem_moto' },
      { key: 'tem_carro', antigoKey: 'tem_carro', novoKey: 'tem_carro' },
      { key: 'sgt_armas', antigoKey: 'sgt_armas', novoKey: 'sgt_armas' },
      { key: 'caveira', antigoKey: 'caveira', novoKey: 'caveira' },
      { key: 'caveira_suplente', antigoKey: 'caveira_suplente', novoKey: 'caveira_suplente' },
      { key: 'batedor', antigoKey: 'batedor', novoKey: 'batedor' },
      { key: 'ursinho', antigoKey: 'ursinho', novoKey: 'ursinho' },
      { key: 'lobo', antigoKey: 'lobo', novoKey: 'lobo' },
      { key: 'combate_insano', antigoKey: 'combate_insano', novoKey: 'combate_insano' },
      { key: 'data_entrada', antigoKey: 'data_entrada', novoKey: 'data_entrada' },
    ];
    
    campos.forEach(campo => {
      const valorAntigo = (antigo as any)[campo.antigoKey];
      const valorNovo = (novo as any)[campo.novoKey] ?? null;
      
      // Normalizar valores para comparação
      const antigoStr = valorAntigo === null ? '' : String(valorAntigo);
      const novoStr = valorNovo === null ? '' : String(valorNovo);
      
      if (antigoStr !== novoStr) {
        alteracoes.push({
          campo: campo.key,
          anterior: antigoStr || '-',
          novo: novoStr || '-',
        });
      }
    });
    
    return alteracoes;
  };

  return (
    <div className="admin-page min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold">Gestao de Integrantes</h1>
            <p className="text-muted-foreground">
              Gerencie o banco de dados de integrantes do portal
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={processing}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Integrantes
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={mensalidadesInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleMensalidadesFileSelect}
          />
        </div>

        {/* Estatisticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Vinculados</p>
                <p className="text-2xl font-bold">{stats.vinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserX className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Nao Vinculados</p>
                <p className="text-2xl font-bold">{stats.naoVinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold">{stats.inativos}</p>
              </div>
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => ultimaCarga && setShowAtualizadosDialog(true)}
            title="Clique para ver detalhes das atualizações"
          >
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Atualizados</p>
                <p className="text-2xl font-bold">{ultimaCarga?.total_atualizados || 0}</p>
                {ultimaCarga && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ultimaCarga.data_carga), 'dd/MM/yyyy HH:mm')}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Card de Mensalidades em Atraso */}
        <Card className="border-orange-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle>Mensalidades em Atraso</CardTitle>
            </div>
            <CardDescription>
              Importe o relatório de mensalidades. Liquidações são detectadas automaticamente a cada novo upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Section */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".xls,.xlsx"
                  ref={mensalidadesInputRef}
                  onChange={handleMensalidadesFileSelect}
                  className="flex-1 hidden"
                />
                <Button 
                  onClick={() => mensalidadesInputRef.current?.click()}
                  disabled={processing}
                  variant="outline"
                  className="flex-1"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Selecionar Arquivo
                </Button>
                {mensalidadesPreview && (
                  <Button 
                    onClick={handleUploadMensalidades}
                    disabled={processing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Confirmar Importação
                  </Button>
                )}
              </div>

              {/* Preview após seleção */}
              {mensalidadesPreview && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Preview da Importação</AlertTitle>
                  <AlertDescription>
                    • {mensalidadesPreview.stats.totalValidas} registros válidos<br/>
                    • {mensalidadesPreview.stats.divisoesEncontradas.length} divisões<br/>
                    • Período: {mensalidadesPreview.stats.periodoRef}
                  </AlertDescription>
                </Alert>
              )}

              {/* Resumo da última carga */}
              {ultimaCargaInfo && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold">Última Carga Ativa</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Data</p>
                      <p className="font-medium">
                        {format(new Date(ultimaCargaInfo.data_carga), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Período</p>
                      <p className="font-medium">
                        {formatRef(ultimaCargaInfo.ref_principal)}
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowHistoricoDialog(true)}
                    className="mt-2"
                  >
                    <History className="mr-2 h-4 w-4" />
                    Ver Histórico Completo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <Input
          placeholder="Buscar por nome de colete..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        {/* Lista de Integrantes */}
        <Tabs defaultValue="todos">
          <TabsList className="grid w-full grid-cols-3 gap-1 sm:gap-2">
            <TabsTrigger value="todos" className="text-xs sm:text-sm px-2">
              Todos 
              <span className="hidden sm:inline ml-1">({stats.total})</span>
            </TabsTrigger>
            <TabsTrigger value="vinculados" className="text-xs sm:text-sm px-2">
              <span className="hidden sm:inline">Vinculados</span>
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline ml-1">({stats.vinculados})</span>
            </TabsTrigger>
            <TabsTrigger value="nao-vinculados" className="text-xs sm:text-sm px-2">
              <span className="hidden sm:inline">Não Vinculados</span>
              <span className="sm:hidden">✗</span>
              <span className="hidden sm:inline ml-1">({stats.naoVinculados})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-4">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrantesFiltrados.map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        {integrante.vinculado ? (
                          <Badge variant="secondary">Vinculado</Badge>
                        ) : (
                          <Badge variant="outline">Disponivel</Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        <p><span className="font-semibold">Regional:</span> {integrante.regional_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="secondary">Vinculado</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="nao-vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => !i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="outline">Disponivel</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog de Histórico */}
        <Dialog open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico de Mensalidades</DialogTitle>
            </DialogHeader>
            <HistoricoDevedores />
          </DialogContent>
        </Dialog>

        {/* Diálogo de Atualizados */}
        {ultimaCarga && (
          <DialogAtualizados
            open={showAtualizadosDialog}
            onOpenChange={setShowAtualizadosDialog}
            cargaId={ultimaCarga.id}
            dataCarga={ultimaCarga.data_carga}
            totalAtualizados={ultimaCarga.total_atualizados}
          />
        )}

        {/* Dialog de Preview de Upload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview das Mudancas</DialogTitle>
            <DialogDescription>
              Revise as mudancas antes de aplicar
            </DialogDescription>
          </DialogHeader>

          {uploadPreview && (
            <div className="space-y-4">
              <Card className="p-4 bg-accent">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">{uploadPreview.file}</p>
                    <p className="text-sm text-muted-foreground">
                      {uploadPreview.excelData.length} registros no arquivo
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Novos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {uploadPreview.delta.novos.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Atualizados</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {uploadPreview.delta.atualizados.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Sem Mudanca</p>
                  <p className="text-3xl font-bold text-gray-600">
                    {uploadPreview.delta.semMudanca}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Removidos</p>
                  <p className="text-3xl font-bold text-red-600">
                    {uploadPreview.delta.removidos.length}
                  </p>
                </Card>
              </div>

              {uploadPreview.delta.novos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Novos Integrantes (primeiros 5):</h4>
                  <div className="space-y-2">
                    {uploadPreview.delta.novos.slice(0, 5).map((item: any, idx: number) => (
                      <Card key={idx} className="p-2 text-sm">
                        <p className="font-semibold">{item.nome_colete}</p>
                        <p className="text-muted-foreground">
                          {item.cargo_grau} - {item.divisao}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApplyChanges} disabled={processing}>
              {processing ? "Processando..." : "Aplicar Mudancas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
};

export default AdminIntegrantes;
