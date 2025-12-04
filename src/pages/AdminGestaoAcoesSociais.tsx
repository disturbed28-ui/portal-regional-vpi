import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowLeft, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Eye, Clock, Settings, Cloud, RefreshCw, Copy, Loader2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { useSolicitacoesExclusaoAcoesSociais } from "@/hooks/useSolicitacoesExclusaoAcoesSociais";
import { useProcessarSolicitacaoExclusaoAcaoSocial } from "@/hooks/useProcessarSolicitacaoExclusaoAcaoSocial";
import { useImportarAcoesSociais } from "@/hooks/useImportarAcoesSociais";
import { useAcoesSociaisPendentesGoogleSheet, ConexaoStatus } from "@/hooks/useAcoesSociaisPendentesGoogleSheet";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { parseAcoesSociaisExcel } from "@/lib/excelAcoesSociaisParser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SERVICE_ACCOUNT_EMAIL = "relatorio-cmd@cmd5-9ae89.iam.gserviceaccount.com";

type StatusFiltro = 'pendente' | 'aprovado' | 'recusado' | 'todos';

interface ImportResult {
  success: boolean;
  inseridos: number;
  duplicados: number;
  erros: { linha: number; motivo: string }[];
  total_processados: number;
}

const AdminGestaoAcoesSociais = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook de configurações do sistema
  const { getSettingTextValue, updateSettingText, isLoading: loadingSettings } = useSystemSettings();
  const spreadsheetIdFromSettings = getSettingTextValue('google_sheets_acoes_sociais_id');
  
  // Estados de configuração da planilha
  const [spreadsheetIdLocal, setSpreadsheetIdLocal] = useState<string>('');
  const [spreadsheetIdAlterado, setSpreadsheetIdAlterado] = useState(false);

  // Atualizar estado local quando carregar do banco
  useEffect(() => {
    if (spreadsheetIdFromSettings && !spreadsheetIdLocal) {
      setSpreadsheetIdLocal(spreadsheetIdFromSettings);
    }
  }, [spreadsheetIdFromSettings, spreadsheetIdLocal]);

  // Verificar se foi alterado
  useEffect(() => {
    setSpreadsheetIdAlterado(spreadsheetIdLocal !== spreadsheetIdFromSettings && spreadsheetIdLocal.length > 0);
  }, [spreadsheetIdLocal, spreadsheetIdFromSettings]);

  // Estados de importação
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<ImportResult | null>(null);
  const [regionais, setRegionais] = useState<{id: string, nome: string}[]>([]);
  const [regionalSelecionada, setRegionalSelecionada] = useState<string>('');
  const [regionalId, setRegionalId] = useState<string | undefined>(undefined);

  // Estados de solicitações de exclusão
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('pendente');
  const { solicitacoes, loading: loadingSolicitacoes, refetch } = useSolicitacoesExclusaoAcoesSociais(statusFiltro);
  const processarMutation = useProcessarSolicitacaoExclusaoAcaoSocial();
  const importarMutation = useImportarAcoesSociais();
  
  // Hook para buscar ações pendentes do Google Sheets
  const {
    acoesPendentes,
    totalNaPlanilha,
    totalJaImportadas,
    loading: loadingPendentes,
    importarTodas,
    importando: importandoPendentes,
    refetch: refetchPendentes,
    conexaoStatus,
    conexaoErro,
    testarConexao,
  } = useAcoesSociaisPendentesGoogleSheet(
    regionalSelecionada, 
    !!regionalSelecionada,
    spreadsheetIdFromSettings || undefined
  );

  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<any>(null);
  const [mostrarDialog, setMostrarDialog] = useState(false);
  const [observacaoAdmin, setObservacaoAdmin] = useState('');

  // Carregar lista de regionais
  useEffect(() => {
    const fetchRegionais = async () => {
      const { data } = await supabase
        .from('regionais')
        .select('id, nome')
        .order('nome');
      
      if (data) {
        setRegionais(data);
        // Pré-selecionar a regional do usuário logado
        if (profile?.regional_id) {
          const userRegional = data.find(r => r.id === profile.regional_id);
          if (userRegional) {
            setRegionalSelecionada(userRegional.nome);
            setRegionalId(userRegional.id);
          }
        }
      }
    };
    fetchRegionais();
  }, [profile?.regional_id]);

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
          variant: "destructive",
        });
        return;
      }
      setArquivoSelecionado(file);
      setResultadoImportacao(null);
    }
  };

  const handleImportar = async () => {
    if (!arquivoSelecionado || !user?.id) return;

    setImportando(true);
    setResultadoImportacao(null);

    try {
      const dados = await parseAcoesSociaisExcel(arquivoSelecionado);
      
      if (dados.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar.",
          variant: "destructive",
        });
        setImportando(false);
        return;
      }

      const resultado = await importarMutation.mutateAsync({
        dados_excel: dados,
        admin_profile_id: user.id,
        regional_id: regionalId,
        regional_texto: regionalSelecionada,
      });

      setResultadoImportacao(resultado);
      setArquivoSelecionado(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImportando(false);
    }
  };

  const handleRegionalChange = (nome: string) => {
    setRegionalSelecionada(nome);
    const regional = regionais.find(r => r.nome === nome);
    setRegionalId(regional?.id);
  };

  const handleSalvarSpreadsheetId = async () => {
    if (!spreadsheetIdLocal.trim()) {
      toast({
        title: "ID inválido",
        description: "Por favor, insira um ID de planilha válido",
        variant: "destructive",
      });
      return;
    }

    await updateSettingText.mutateAsync({
      chave: 'google_sheets_acoes_sociais_id',
      valor_texto: spreadsheetIdLocal.trim(),
    });
    
    setSpreadsheetIdAlterado(false);
  };

  const handleCopiarEmail = () => {
    navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
    toast({
      title: "Email copiado!",
      description: "O email do service account foi copiado para a área de transferência",
    });
  };

  const handleTestarConexao = async () => {
    const result = await testarConexao();
    if (result) {
      toast({
        title: "Conexão estabelecida",
        description: "A planilha está acessível e configurada corretamente",
      });
    } else {
      toast({
        title: "Falha na conexão",
        description: conexaoErro || "Verifique se a planilha está compartilhada com o service account",
        variant: "destructive",
      });
    }
  };

  const getConexaoStatusBadge = (status: ConexaoStatus) => {
    switch (status) {
      case 'testando':
        return (
          <Badge variant="outline" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Testando...
          </Badge>
        );
      case 'conectado':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
            <CheckCircle className="h-3 w-3 mr-1" />
            Conexão estabelecida
          </Badge>
        );
      case 'erro':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Sem conexão
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Link2 className="h-3 w-3 mr-1" />
            Não testado
          </Badge>
        );
    }
  };

  const handleVerDetalhes = (solicitacao: any) => {
    setSolicitacaoSelecionada(solicitacao);
    setObservacaoAdmin('');
    setMostrarDialog(true);
  };

  const handleProcessar = async (novoStatus: 'aprovado' | 'recusado') => {
    if (!solicitacaoSelecionada) return;

    await processarMutation.mutateAsync({
      solicitacaoId: solicitacaoSelecionada.id,
      registroId: solicitacaoSelecionada.registro_id,
      novoStatus,
      observacaoAdmin: observacaoAdmin.trim() || undefined,
    });

    setMostrarDialog(false);
    setSolicitacaoSelecionada(null);
    setObservacaoAdmin('');
    refetch();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50', icon: <Clock className="h-3 w-3 mr-1" /> },
      aprovado: { label: 'Aprovado', className: 'bg-green-500/20 text-green-500 border-green-500/50', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      recusado: { label: 'Recusado', className: 'bg-red-500/20 text-red-500 border-red-500/50', icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const variant = variants[status as keyof typeof variants] || variants.pendente;
    return (
      <Badge variant="outline" className={`${variant.className} flex items-center w-fit`}>
        {variant.icon}
        {variant.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary" />
              Gestão de Ações Sociais
            </h1>
            <p className="text-sm text-muted-foreground">
              Importação de dados e gerenciamento de solicitações
            </p>
          </div>
        </div>

        <Tabs defaultValue="importar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="importar" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Ações
            </TabsTrigger>
            <TabsTrigger value="exclusoes" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Solicitações
            </TabsTrigger>
          </TabsList>

          {/* Tab de Importação */}
          <TabsContent value="importar" className="space-y-6">
            {/* Seleção de Regional */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Regional para Importação
                </CardTitle>
                <CardDescription>
                  Selecione a regional cujas ações serão importadas do Excel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="regional-select">Regional</Label>
                  <Select value={regionalSelecionada} onValueChange={handleRegionalChange}>
                    <SelectTrigger id="regional-select" className="w-full md:w-[400px]">
                      <SelectValue placeholder="Selecione a regional" />
                    </SelectTrigger>
                    <SelectContent>
                      {regionais.map((r) => (
                        <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Somente ações desta regional serão importadas do arquivo
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ações Pendentes do Google Sheets */}
            {regionalSelecionada && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        Ações Pendentes (Google Sheets)
                      </CardTitle>
                      <CardDescription>
                        Ações da regional {regionalSelecionada} que ainda não foram importadas
                      </CardDescription>
                    </div>
                    {getConexaoStatusBadge(conexaoStatus)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Configuração da Planilha */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Configuração da Planilha</Label>
                    </div>

                    {/* Campo para ID da planilha */}
                    <div className="space-y-2">
                      <Label htmlFor="spreadsheet-id" className="text-xs text-muted-foreground">
                        ID da Planilha do Google Sheets
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="spreadsheet-id"
                          value={spreadsheetIdLocal}
                          onChange={(e) => setSpreadsheetIdLocal(e.target.value)}
                          placeholder="Ex: 1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo"
                          className="font-mono text-xs"
                        />
                        <Button 
                          variant="outline" 
                          onClick={handleSalvarSpreadsheetId}
                          disabled={!spreadsheetIdAlterado || updateSettingText.isPending}
                        >
                          {updateSettingText.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Salvar"
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={handleTestarConexao}
                          disabled={conexaoStatus === 'testando'}
                          title="Testar conexão"
                        >
                          {conexaoStatus === 'testando' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Alerta sobre compartilhamento (aparece ao trocar) */}
                    {spreadsheetIdAlterado && (
                      <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/50">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-600">
                          Ao trocar a planilha, você precisa compartilhá-la com o email do service account abaixo (permissão de leitor).
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Email do service account com botão copiar */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Email do Service Account (compartilhe a planilha com este email)
                      </Label>
                      <div className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                        <code className="text-xs flex-1 font-mono truncate">
                          {SERVICE_ACCOUNT_EMAIL}
                        </code>
                        <Button variant="ghost" size="sm" onClick={handleCopiarEmail} title="Copiar email">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Conteúdo principal */}
                  {loadingPendentes ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                      <span className="text-muted-foreground">Buscando na planilha...</span>
                    </div>
                  ) : acoesPendentes.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="font-medium">Sem ações pendentes para importar</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {totalJaImportadas > 0 
                          ? `Todas as ${totalJaImportadas} ações desta regional já estão no sistema`
                          : "Nenhuma ação encontrada para esta regional na planilha"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => refetchPendentes()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Verificar novamente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Resumo */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-2xl font-bold">{totalNaPlanilha}</p>
                          <p className="text-xs text-muted-foreground">Total na planilha</p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{totalJaImportadas}</p>
                          <p className="text-xs text-muted-foreground">Já importadas</p>
                        </div>
                        <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                          <p className="text-2xl font-bold text-yellow-600">{acoesPendentes.length}</p>
                          <p className="text-xs text-muted-foreground">Pendentes</p>
                        </div>
                      </div>

                      {/* Lista prévia */}
                      <ScrollArea className="h-[200px] border rounded-lg">
                        <div className="p-2 space-y-2">
                          {acoesPendentes.slice(0, 5).map((acao, idx) => (
                            <div key={idx} className="p-2 bg-muted/30 rounded border-l-2 border-yellow-500">
                              <p className="font-medium text-sm">{acao.responsavel}</p>
                              <p className="text-xs text-muted-foreground">
                                {acao.data_acao} • {acao.tipo_acao || "Sem tipo"} • {acao.divisao || "Sem divisão"}
                              </p>
                            </div>
                          ))}
                          {acoesPendentes.length > 5 && (
                            <p className="text-sm text-muted-foreground p-2 text-center">
                              ... e mais {acoesPendentes.length - 5} ações pendentes
                            </p>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Botão de importação */}
                      <Button
                        onClick={() => user?.id && importarTodas(user.id, regionalId)}
                        disabled={importandoPendentes}
                        className="w-full"
                      >
                        {importandoPendentes ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar {acoesPendentes.length} ações
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload de Arquivo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importar Arquivo Excel
                </CardTitle>
                <CardDescription>
                  Selecione o arquivo Excel exportado do Google Forms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="excel-file"
                  />
                  <label htmlFor="excel-file" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: .xlsx, .xls
                    </p>
                  </label>
                </div>

                {arquivoSelecionado && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">{arquivoSelecionado.name}</span>
                    </div>
                    <Button onClick={handleImportar} disabled={importando || !regionalSelecionada}>
                      {importando ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                          Processando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Processar Importação
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!regionalSelecionada && (
                  <p className="text-sm text-destructive">
                    Selecione uma regional acima antes de importar.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Resultado da Importação */}
            {resultadoImportacao && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resultado da Importação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{resultadoImportacao.total_processados}</p>
                      <p className="text-xs text-muted-foreground">Total Processados</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{resultadoImportacao.inseridos}</p>
                      <p className="text-xs text-muted-foreground">Importados</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{resultadoImportacao.duplicados}</p>
                      <p className="text-xs text-muted-foreground">Duplicados</p>
                    </div>
                    <div className="text-center p-4 bg-red-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{resultadoImportacao.erros.length}</p>
                      <p className="text-xs text-muted-foreground">Com Erros</p>
                    </div>
                  </div>

                  {resultadoImportacao.erros.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2 text-destructive">Erros encontrados:</h4>
                      <ScrollArea className="h-[200px] border rounded-lg p-3">
                        {resultadoImportacao.erros.map((erro, idx) => (
                          <div key={idx} className="text-sm py-1 border-b last:border-0">
                            <span className="text-muted-foreground">Linha {erro.linha}:</span>{' '}
                            {erro.motivo}
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab de Solicitações de Exclusão */}
          <TabsContent value="exclusoes" className="space-y-6">
            <div className="mb-6">
              <Label htmlFor="status-filter" className="mb-2 block">Filtrar por status:</Label>
              <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="aprovado">Aprovadas</SelectItem>
                  <SelectItem value="recusado">Recusadas</SelectItem>
                  <SelectItem value="todos">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingSolicitacoes && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando solicitações...</p>
              </div>
            )}

            {!loadingSolicitacoes && solicitacoes.length === 0 && (
              <Card className="p-12 text-center">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma solicitação encontrada</h3>
                <p className="text-sm text-muted-foreground">
                  Não há solicitações de exclusão com o status "{statusFiltro}".
                </p>
              </Card>
            )}

            {!loadingSolicitacoes && solicitacoes.length > 0 && (
              <div className="grid gap-4">
                {solicitacoes.map((solicitacao: any) => (
                  <Card key={solicitacao.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {solicitacao.registro?.responsavel_nome_colete || 'Desconhecido'}
                            {getStatusBadge(solicitacao.status)}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Solicitado em {format(new Date(solicitacao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(solicitacao)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold">Data da Ação:</span>
                          <p className="text-muted-foreground">
                            {format(new Date(solicitacao.registro?.data_acao || ''), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold">Tipo de Ação:</span>
                          <p className="text-muted-foreground">
                            {solicitacao.registro?.tipo_acao_nome_snapshot || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de Detalhes */}
        <Dialog open={mostrarDialog} onOpenChange={setMostrarDialog}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Detalhes da Solicitação</DialogTitle>
              <DialogDescription>Analise as informações antes de processar</DialogDescription>
            </DialogHeader>

            {solicitacaoSelecionada && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  <div>
                    <Label className="mb-2 block">Status:</Label>
                    {getStatusBadge(solicitacaoSelecionada.status)}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold">Ação Social</h4>
                    <div className="bg-muted/50 border rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold">Data:</span>
                        <span>{format(new Date(solicitacaoSelecionada.registro?.data_acao || ''), 'dd/MM/yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Tipo:</span>
                        <span>{solicitacaoSelecionada.registro?.tipo_acao_nome_snapshot || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Divisão:</span>
                        <span>{solicitacaoSelecionada.registro?.divisao_relatorio_texto || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Responsável:</span>
                        <span>{solicitacaoSelecionada.registro?.responsavel_nome_colete || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Justificativa do Usuário:</Label>
                    <div className="bg-card border rounded-lg p-4">
                      <p className="whitespace-pre-wrap">{solicitacaoSelecionada.justificativa || 'Nenhuma justificativa'}</p>
                    </div>
                  </div>

                  {solicitacaoSelecionada.status === 'pendente' && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="observacao-admin">Observação Administrativa (opcional)</Label>
                        <Textarea
                          id="observacao-admin"
                          placeholder="Adicione uma observação..."
                          value={observacaoAdmin}
                          onChange={(e) => setObservacaoAdmin(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              {solicitacaoSelecionada?.status === 'pendente' ? (
                <>
                  <Button variant="outline" onClick={() => setMostrarDialog(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={() => handleProcessar('recusado')} disabled={processarMutation.isPending}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Recusar
                  </Button>
                  <Button onClick={() => handleProcessar('aprovado')} disabled={processarMutation.isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {processarMutation.isPending ? 'Processando...' : 'Aprovar'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setMostrarDialog(false)}>Fechar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminGestaoAcoesSociais;
