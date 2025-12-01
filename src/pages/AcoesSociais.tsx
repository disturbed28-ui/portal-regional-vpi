import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Calendar, Users, MapPin, Send, Trash2, Eye, Plus, RefreshCw, AlertCircle, X, Filter, CalendarIcon } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcoesSociaisLista } from "@/hooks/useAcoesSociaisLista";
import { useDivisoes } from "@/hooks/useDivisoes";
import { useEnviarAcaoSocialParaFormClube } from "@/hooks/useEnviarAcaoSocialParaFormClube";
import { useSolicitarExclusaoAcaoSocial } from "@/hooks/useSolicitarExclusaoAcaoSocial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AcoesSociais() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/acoes-sociais', user?.id);
  const { roles, loading: loadingRoles } = useUserRole(user?.id);
  const isModeradorOuAdmin = roles.includes('moderator') || roles.includes('admin');

  // Estados de filtro de período e divisão
  const hoje = new Date();
  const umMesAtras = subMonths(hoje, 1);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(umMesAtras);
  const [dataFim, setDataFim] = useState<Date | undefined>(hoje);
  const [divisaoFiltro, setDivisaoFiltro] = useState<string>('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Buscar dados
  const { divisoes } = useDivisoes();
  const { registros, loading, refetch } = useAcoesSociaisLista({
    dataInicio,
    dataFim,
    divisaoId: divisaoFiltro || undefined,
  });
  const enviarMutation = useEnviarAcaoSocialParaFormClube();
  const solicitarExclusaoMutation = useSolicitarExclusaoAcaoSocial();

  const [registroSelecionado, setRegistroSelecionado] = useState<any>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [mostrarExclusao, setMostrarExclusao] = useState(false);
  const [justificativaExclusao, setJustificativaExclusao] = useState("");
  const [mostrarConfirmacaoEnvio, setMostrarConfirmacaoEnvio] = useState(false);
  const [registroParaEnvio, setRegistroParaEnvio] = useState<any>(null);
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null);

  // Protecao de acesso
  if (loadingAccess || loadingRoles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissoes...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    navigate('/');
    return null;
  }

  const handleVerDetalhes = (registro: any) => {
    setRegistroSelecionado(registro);
    setMostrarDetalhes(true);
  };

  const handleAbrirConfirmacaoEnvio = (registro: any) => {
    setRegistroParaEnvio(registro);
    setMostrarConfirmacaoEnvio(true);
  };

  const handleConfirmarEnvio = async () => {
    if (!registroParaEnvio) return;
    
    await enviarMutation.mutateAsync(registroParaEnvio.id);
    setMostrarConfirmacaoEnvio(false);
    setRegistroParaEnvio(null);
    refetch();
  };

  const handleSolicitarExclusao = (registro: any) => {
    setRegistroSelecionado(registro);
    setMostrarExclusao(true);
    setJustificativaExclusao("");
  };

  const handleConfirmarExclusao = async () => {
    if (!justificativaExclusao.trim()) {
      return;
    }

    await solicitarExclusaoMutation.mutateAsync({
      registro_id: registroSelecionado.id,
      justificativa: justificativaExclusao,
    });

    setMostrarExclusao(false);
    setRegistroSelecionado(null);
    setJustificativaExclusao("");
    refetch();
  };

  const limparFiltros = () => {
    setDataInicio(subMonths(new Date(), 1));
    setDataFim(new Date());
    setDivisaoFiltro('');
  };

  const getSolicitacaoStatus = (registro: any) => {
    const solicitacao = registro.solicitacao_exclusao?.[0];
    return solicitacao || null;
  };

  const getSolicitacaoBadge = (registro: any) => {
    const solicitacao = getSolicitacaoStatus(registro);
    
    if (!solicitacao) return null;
    
    if (solicitacao.status === 'pendente') {
      return (
        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
          Exclusão em análise
        </Badge>
      );
    }
    
    if (solicitacao.status === 'recusado') {
      return (
        <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/50">
          Exclusão recusada
        </Badge>
      );
    }
    
    if (solicitacao.status === 'aprovado') {
      return (
        <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
          Exclusão aprovada
        </Badge>
      );
    }
    
    return null;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'nao_enviado': { label: 'Nao Enviado', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' },
      'enviado': { label: 'Enviado', className: 'bg-green-500/20 text-green-500 border-green-500/50' },
      'erro': { label: 'Erro', className: 'bg-red-500/20 text-red-500 border-red-500/50' },
    };

    const variant = variants[status as keyof typeof variants] || variants.nao_enviado;

    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getEscopoBadge = (escopo: string) => {
    return escopo === 'externa' ? (
      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
        Externa
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
        Interna
      </Badge>
    );
  };

  // Contagens para os filtros
  const contagens = {
    todos: registros.length,
    nao_enviado: registros.filter(r => r.google_form_status === 'nao_enviado').length,
    enviado: registros.filter(r => r.google_form_status === 'enviado').length,
    erro: registros.filter(r => r.google_form_status === 'erro').length,
  };

  // Aplicar filtro
  const registrosFiltrados = filtroStatus 
    ? registros.filter(r => r.google_form_status === filtroStatus)
    : registros;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-full sm:max-w-4xl mx-auto space-y-4">
        {/* Header - Mobile First */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-2xl font-bold">Ações Sociais</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Consulta e gerenciamento</p>
            </div>
          </div>
          
          {/* Ações do Header - Empilhadas em mobile */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Badge variant="secondary" className="h-8 px-3 text-xs sm:text-sm">
                {filtroStatus ? `${registrosFiltrados.length}/${registros.length}` : registros.length} {registrosFiltrados.length === 1 ? 'ação' : 'ações'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="sm:hidden flex-1"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/formularios/acoes_sociais')}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>Nova Ação</span>
            </Button>
          </div>
        </div>

        {/* Filtros de Período e Divisão - Colapsável em mobile */}
        {(mostrarFiltros || window.innerWidth >= 640) && (
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              {/* Linha 1: Datas */}
              <div className="grid grid-cols-2 gap-2">
                {/* Data Início */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left text-xs sm:text-sm h-9"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        {dataInicio ? format(dataInicio, 'dd/MM/yy', { locale: ptBR }) : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data Fim */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left text-xs sm:text-sm h-9"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        {dataFim ? format(dataFim, 'dd/MM/yy', { locale: ptBR }) : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Linha 2: Divisão + Limpar */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={divisaoFiltro} onValueChange={setDivisaoFiltro}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Todas as divisões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as divisões</SelectItem>
                      {divisoes.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={limparFiltros}
                  className="h-9 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Filtros de Status - Scroll horizontal em mobile */}
        {!loading && registros.length > 0 && (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex gap-2 min-w-max sm:flex-wrap">
              <Button
                size="sm"
                variant={filtroStatus === null ? 'default' : 'outline'}
                onClick={() => setFiltroStatus(null)}
                className="text-xs sm:text-sm"
              >
                Todos ({contagens.todos})
              </Button>
              <Button
                size="sm"
                variant={filtroStatus === 'nao_enviado' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('nao_enviado')}
                className={`text-xs sm:text-sm ${filtroStatus !== 'nao_enviado' ? 'border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10' : ''}`}
              >
                Não Enviados ({contagens.nao_enviado})
              </Button>
              <Button
                size="sm"
                variant={filtroStatus === 'enviado' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('enviado')}
                className={`text-xs sm:text-sm ${filtroStatus !== 'enviado' ? 'border-green-500/50 text-green-600 hover:bg-green-500/10' : ''}`}
              >
                Enviados ({contagens.enviado})
              </Button>
              <Button
                size="sm"
                variant={filtroStatus === 'erro' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('erro')}
                className={`text-xs sm:text-sm ${filtroStatus !== 'erro' ? 'border-red-500/50 text-red-600 hover:bg-red-500/10' : ''}`}
              >
                Com Erro ({contagens.erro})
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando acoes sociais...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && registros.length === 0 && (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma acao social encontrada</h3>
            <p className="text-sm text-muted-foreground">
              Ainda nao ha acoes sociais registradas para visualizacao.
            </p>
          </Card>
        )}

        {/* Empty State com Filtro */}
        {!loading && registros.length > 0 && registrosFiltrados.length === 0 && (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma ação com este status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não há ações sociais com o filtro "{filtroStatus === 'nao_enviado' ? 'Não Enviados' : filtroStatus === 'enviado' ? 'Enviados' : 'Com Erro'}" selecionado.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltroStatus(null)}
            >
              Limpar Filtro
            </Button>
          </Card>
        )}

        {/* Grid de Cards */}
        <div className="grid gap-4">
          {registrosFiltrados.map((registro) => (
            <Card key={registro.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <CardTitle className="text-sm sm:text-base">
                      {new Date(registro.data_acao).toLocaleDateString('pt-BR')}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {getStatusBadge(registro.google_form_status)}
                    {getEscopoBadge(registro.escopo_acao)}
                    {getSolicitacaoBadge(registro)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{registro.tipo_acao_nome_snapshot}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs sm:text-sm">{registro.divisao_relatorio_texto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs sm:text-sm">{registro.responsavel_nome_colete}</span>
                    {registro.responsavel_cargo_nome && (
                      <span className="text-muted-foreground text-xs">• {registro.responsavel_cargo_nome}</span>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  {/* BOTÃO DETALHES - SEMPRE VISÍVEL */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerDetalhes(registro)}
                    className="text-xs sm:text-sm"
                  >
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Detalhes
                  </Button>

                  {/* BOTÕES APENAS PARA MODERADOR/ADMIN */}
                  {isModeradorOuAdmin && (
                    <>
            {/* BOTÃO ENVIAR AO FORM / TENTAR NOVAMENTE */}
            {(registro.google_form_status === 'nao_enviado' || registro.google_form_status === 'erro') && 
             getSolicitacaoStatus(registro)?.status !== 'pendente' && (
              <Button
                size="sm"
                variant={registro.google_form_status === 'erro' ? 'outline' : 'default'}
                onClick={() => handleAbrirConfirmacaoEnvio(registro)}
                disabled={enviarMutation.isPending}
                className={`text-xs sm:text-sm ${registro.google_form_status === 'erro' ? 'border-orange-500 text-orange-600 hover:bg-orange-500/10' : ''}`}
              >
                {registro.google_form_status === 'erro' ? (
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                ) : (
                  <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                )}
                {registro.google_form_status === 'erro' ? 'Tentar' : 'Enviar'}
              </Button>
            )}

                      {/* BOTÃO SOLICITAR EXCLUSÃO - Apenas se não foi enviado e não houver solicitação pendente */}
                      {registro.google_form_status !== 'enviado' &&
                       (!getSolicitacaoStatus(registro) || getSolicitacaoStatus(registro)?.status !== 'pendente') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSolicitarExclusao(registro)}
                          disabled={solicitarExclusaoMutation.isPending || getSolicitacaoStatus(registro)?.status === 'pendente'}
                          className="col-span-2 text-xs sm:text-sm"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Solicitar Exclusão
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal de Detalhes */}
        <Dialog open={mostrarDetalhes} onOpenChange={setMostrarDetalhes}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Acao Social</DialogTitle>
            </DialogHeader>
            {registroSelecionado && (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted-foreground">Data da Acao:</span>
                      <p className="font-medium">
                        {new Date(registroSelecionado.data_acao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status de Envio:</span>
                      <div className="mt-1">
                        {getStatusBadge(registroSelecionado.google_form_status)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Tipo de Acao:</span>
                    <p className="font-medium">{registroSelecionado.tipo_acao_nome_snapshot}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Escopo:</span>
                    <div className="mt-1">
                      {getEscopoBadge(registroSelecionado.escopo_acao)}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Regional:</span>
                    <p className="font-medium">{registroSelecionado.regional_relatorio_texto}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Divisao:</span>
                    <p className="font-medium">{registroSelecionado.divisao_relatorio_texto}</p>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Responsavel:</span>
                    <p className="font-medium">{registroSelecionado.responsavel_nome_colete}</p>
                  </div>

                  {registroSelecionado.responsavel_cargo_nome && (
                    <div>
                      <span className="text-muted-foreground">Cargo:</span>
                      <p className="font-medium">{registroSelecionado.responsavel_cargo_nome}</p>
                    </div>
                  )}

                  {registroSelecionado.descricao_acao && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-muted-foreground">Descricao:</span>
                        <p className="mt-1 whitespace-pre-wrap">{registroSelecionado.descricao_acao}</p>
                      </div>
                    </>
                  )}

                  {registroSelecionado.google_form_status === 'enviado' && (
                    <>
                      <Separator />
                      <div className="bg-green-500/10 p-3 rounded-md">
                        <p className="text-green-500 font-medium mb-1">Enviado ao Formulario Oficial</p>
                        {registroSelecionado.google_form_enviado_em && (
                          <p className="text-xs text-muted-foreground">
                            Em {new Date(registroSelecionado.google_form_enviado_em).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* SEÇÃO DE ERRO */}
                  {registroSelecionado.google_form_status === 'erro' && (
                    <>
                      <Separator />
                      <div className="bg-red-500/10 p-3 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <p className="text-red-500 font-medium">Erro ao Enviar ao Formulário</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Houve um problema ao enviar esta ação para o formulário oficial. 
                          Você pode tentar novamente.
                        </p>
                        {isModeradorOuAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
                            onClick={() => {
                              setMostrarDetalhes(false);
                              handleAbrirConfirmacaoEnvio(registroSelecionado);
                            }}
                            disabled={enviarMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Tentar Novamente
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {/* MOSTRAR MOTIVO DA RECUSA SE EXISTIR */}
                  {getSolicitacaoStatus(registroSelecionado)?.status === 'recusado' && (
                    <>
                      <Separator />
                      <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                        <p className="text-red-500 font-semibold mb-2">❌ Solicitacao de Exclusao Recusada</p>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Motivo da recusa:</p>
                          <p className="text-sm text-foreground">
                            {getSolicitacaoStatus(registroSelecionado)?.observacao_admin || 'Sem observacao'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    <p>Criado em: {new Date(registroSelecionado.created_at).toLocaleString('pt-BR')}</p>
                    {registroSelecionado.updated_at !== registroSelecionado.created_at && (
                      <p>Atualizado em: {new Date(registroSelecionado.updated_at).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Solicitacao de Exclusao */}
        <Dialog open={mostrarExclusao} onOpenChange={setMostrarExclusao}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Exclusao</DialogTitle>
              <DialogDescription>
                Informe o motivo da solicitacao de exclusao. Um administrador ira analisar sua solicitacao.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Digite a justificativa para a exclusao desta acao social..."
                value={justificativaExclusao}
                onChange={(e) => setJustificativaExclusao(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMostrarExclusao(false)}
                disabled={solicitarExclusaoMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmarExclusao}
                disabled={!justificativaExclusao.trim() || solicitarExclusaoMutation.isPending}
              >
                {solicitarExclusaoMutation.isPending ? 'Solicitando...' : 'Solicitar Exclusao'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmacao de Envio ao Formulario */}
        <Dialog open={mostrarConfirmacaoEnvio} onOpenChange={setMostrarConfirmacaoEnvio}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar envio ao formulario?</DialogTitle>
              <DialogDescription>
                Voce confirma o envio desta acao para o formulario oficial do clube? Apos o envio, ela sera registrada no banco de dados oficial.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMostrarConfirmacaoEnvio(false)}
                disabled={enviarMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={handleConfirmarEnvio}
                disabled={enviarMutation.isPending}
              >
                {enviarMutation.isPending ? 'Enviando...' : 'Confirmar envio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
