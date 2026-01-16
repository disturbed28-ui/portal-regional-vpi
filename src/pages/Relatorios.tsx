import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useScreenAccess } from '@/hooks/useScreenAccess';
import { useProfile } from '@/hooks/useProfile';
import { useRelatorioData } from '@/hooks/useRelatorioData';
import { useHistoricoCargas } from '@/hooks/useHistoricoCargas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardInadimplencia } from '@/components/relatorios/DashboardInadimplencia';
import { GraficoEvolucao } from '@/components/relatorios/GraficoEvolucao';
import { TabelaComparativa } from '@/components/relatorios/TabelaComparativa';
import { RelatorioSemanalDivisaoAba } from '@/components/relatorios/RelatorioSemanalDivisaoAba';
import { IntegrantesTab } from '@/components/relatorios/IntegrantesTab';
import { HistoricoMovimentacoes } from '@/components/relatorios/HistoricoMovimentacoes';
import { formatarDataBrasil } from '@/lib/timezone';
import { toast } from '@/hooks/use-toast';
import { useAfastadosAtivos, useAfastadosHistorico, useRetornosProximos, useRegistrarRetorno, type IntegranteAfastado } from '@/hooks/useAfastados';
import { ModalBaixaAfastado, type MotivoBaixa } from '@/components/admin/ModalBaixaAfastado';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Users, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardDescription } from '@/components/ui/card';
import { toast as sonnerToast } from 'sonner';
import { getEscopoVisibilidade, temVisibilidadeTotal } from '@/lib/escopoVisibilidade';

const Relatorios = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasRole, roles, loading: rolesLoading } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess("/relatorios", user?.id);
  const { hasAccess: hasAccessSemanalAba, loading: loadingAccessSemanalAba } = useScreenAccess('/relatorios/semanal-divisao', user?.id);
  const { hasAccess: hasAccessIntegrantes } = useScreenAccess('/relatorios/integrantes', user?.id);

  // Determinar escopo de visibilidade usando função centralizada
  const isAdmin = hasRole('admin');
  const escopo = useMemo(() => {
    if (rolesLoading || profileLoading) return null;
    return getEscopoVisibilidade(profile, roles, isAdmin);
  }, [profile, roles, isAdmin, rolesLoading, profileLoading]);

  // REGRA: Filtro de regional baseado no escopo
  const regionalTextoFiltro: string | undefined = useMemo(() => {
    if (!escopo) return undefined; // Aguardar carregamento
    
    // Comando sem filtro obrigatório vê tudo
    if (temVisibilidadeTotal(escopo)) {
      return undefined;
    }
    
    // Admin, Grau V e VI veem apenas sua regional
    return escopo.regionalTexto || undefined;
  }, [escopo]);

  // Determinar regionalId para filtro de histórico (Evolução)
  const regionalIdHistorico = useMemo(() => {
    if (!escopo) return undefined;
    
    // Comando sem filtro obrigatório vê tudo
    if (temVisibilidadeTotal(escopo)) {
      return undefined;
    }
    
    // Admin, Regional e Divisão veem apenas sua regional
    return escopo.regionalId || undefined;
  }, [escopo]);

  // Texto de escopo para exibição
  const escopoTexto = useMemo(() => {
    if (!escopo) return '';
    
    if (temVisibilidadeTotal(escopo)) {
      return 'Escopo do dashboard: Comando (todas as regionais)';
    }
    
    // Admin ou Regional/Divisão mostram a regional atual
    const prefixo = isAdmin ? 'Admin - ' : '';
    return `Escopo do dashboard: ${prefixo}Regional ${escopo.regionalTexto || ''}`;
  }, [escopo, isAdmin]);

  const { data: relatorioData, isLoading } = useRelatorioData(regionalTextoFiltro);
  const { data: historicoData, isLoading: isLoadingHistorico } = useHistoricoCargas({
    enabled: !!user?.id && hasAccess && !loadingAccess,
    regionalId: regionalIdHistorico
  });

  // Hooks para afastamentos
  const { afastados: ativos, loading: loadingAtivos, refetch: refetchAtivos } = useAfastadosAtivos();
  const { afastados: historico, loading: loadingHistorico } = useAfastadosHistorico();
  const { afastados: proximos7, loading: loadingProximos7 } = useRetornosProximos(7);
  const { afastados: proximos30, loading: loadingProximos30 } = useRetornosProximos(30);
  const { registrarRetorno } = useRegistrarRetorno();
  
  // Redirecionamento em caso de acesso negado
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

  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (user && !profileLoading && profile && !profile.nome_colete) {
      toast({
        title: "Complete seu cadastro",
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [user, profileLoading, profile, navigate]);

  // Estado para modal de baixa de afastado
  const [modalBaixaOpen, setModalBaixaOpen] = useState(false);
  const [afastadoSelecionado, setAfastadoSelecionado] = useState<IntegranteAfastado | null>(null);

  // Funções auxiliares para afastamentos
  const handleAbrirModalBaixa = (afastado: IntegranteAfastado) => {
    setAfastadoSelecionado(afastado);
    setModalBaixaOpen(true);
  };

  const handleConfirmarBaixa = async (motivo: MotivoBaixa, observacao?: string) => {
    if (!afastadoSelecionado) return;
    
    try {
      await registrarRetorno(afastadoSelecionado.id, { motivo, observacoes: observacao });
      
      const mensagens = {
        retornou: 'Retorno registrado com sucesso!',
        desligamento: 'Desligamento registrado com sucesso!',
        outro: 'Baixa registrada com sucesso!'
      };
      
      sonnerToast.success(mensagens[motivo]);
      refetchAtivos();
      setModalBaixaOpen(false);
      setAfastadoSelecionado(null);
    } catch (error) {
      sonnerToast.error('Erro ao registrar baixa. Verifique suas permissões.');
    }
  };

  const getDiasRestantes = (dataRetorno: string) => {
    const hoje = new Date();
    const retorno = new Date(dataRetorno);
    return differenceInDays(retorno, hoje);
  };

  const getStatusRetorno = (dataRetornoPrevista: string, dataRetornoEfetivo: string | null) => {
    if (!dataRetornoEfetivo) return null;
    
    const prevista = new Date(dataRetornoPrevista);
    const efetiva = new Date(dataRetornoEfetivo);
    const diff = differenceInDays(efetiva, prevista);
    
    if (diff === 0) return { label: 'No prazo', variant: 'default' as const };
    if (diff < 0) return { label: `${Math.abs(diff)}d adiantado`, variant: 'default' as const };
    return { label: `${diff}d atrasado`, variant: 'destructive' as const };
  };

  // Dashboard stats para afastamentos
  const totalAtivos = ativos.length;
  const retornosAtrasados = ativos.filter(a => getDiasRestantes(a.data_retorno_prevista) < 0).length;
  const divisoesAfetadas = new Set(ativos.map(a => a.divisao_texto)).size;

  // Loading de permissões
  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  // Loading de dados
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <p className="text-lg">Carregando relatório...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-6">
        {/* Header */}
        <div className="mb-3 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold truncate">Relatórios</h1>
              {relatorioData?.dataCarga && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                  Última atualização: {formatarDataBrasil(relatorioData.dataCarga)}
                </p>
              )}
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {escopoTexto}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        {relatorioData && (
        <Tabs defaultValue={hasAccessIntegrantes ? "integrantes" : "evolucao"} className="w-full">
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex min-w-max gap-0.5 sm:gap-1">
              {hasAccessIntegrantes && (
                <TabsTrigger value="integrantes" className="text-xs sm:text-sm px-2 sm:px-3">
                  Integrantes
                </TabsTrigger>
              )}
              <TabsTrigger value="evolucao" className="text-xs sm:text-sm px-2 sm:px-3">
                Evolução
              </TabsTrigger>
              <TabsTrigger value="inadimplencia" className="text-xs sm:text-sm px-2 sm:px-3">
                Inadimplência
              </TabsTrigger>
              <TabsTrigger value="afastamentos" className="text-xs sm:text-sm px-2 sm:px-3">
                Afastamentos
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="text-xs sm:text-sm px-2 sm:px-3">
                <ArrowRightLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Movimentações
              </TabsTrigger>
              {hasAccessSemanalAba && (
                <TabsTrigger value="semanal" className="text-xs sm:text-sm px-2 sm:px-3">
                  Rel. Semanal
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          
          {hasAccessIntegrantes && (
            <TabsContent value="integrantes" className="mt-3 sm:mt-6">
              <IntegrantesTab />
            </TabsContent>
          )}
              
              <TabsContent value="evolucao">
                {isLoadingHistorico ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Carregando histórico...</p>
                    </CardContent>
                  </Card>
                ) : historicoData && historicoData.cargas.length >= 2 ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Evolução do Efetivo - Regional Vale do Paraíba I</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GraficoEvolucao 
                          cargas={historicoData.cargas} 
                          divisoesUnicas={historicoData.divisoesUnicas}
                        />
                      </CardContent>
                    </Card>
                    
                    <TabelaComparativa 
                      cargas={historicoData.cargas}
                      divisoesUnicas={historicoData.divisoesUnicas}
                    />
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Dados históricos insuficientes. São necessárias pelo menos 2 cargas para exibir a evolução.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="inadimplencia">
                <DashboardInadimplencia userId={user?.id} />
              </TabsContent>

              {/* Nova aba Afastamentos */}
              <TabsContent value="afastamentos">
                <Tabs defaultValue="ativos" className="w-full">
                  <div className="overflow-x-auto -mx-4 px-4 pb-2">
                    <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
                      <TabsTrigger value="ativos" className="flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Ativos</TabsTrigger>
                      <TabsTrigger value="historico" className="flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Histórico</TabsTrigger>
                      <TabsTrigger value="retornos" className="flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Retornos Próximos</TabsTrigger>
                      <TabsTrigger value="dashboard" className="flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">Dashboard</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Sub-aba Ativos */}
                  <TabsContent value="ativos">
                    <Card>
                      <CardHeader>
                        <CardTitle>Afastamentos Ativos</CardTitle>
                        <CardDescription>
                          {totalAtivos} integrante(s) atualmente afastado(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loadingAtivos ? (
                          <p>Carregando...</p>
                        ) : ativos.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            Nenhum afastamento ativo no momento
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-3 text-muted-foreground">Número</th>
                                  <th className="text-left p-3 text-muted-foreground">Nome</th>
                                  <th className="text-left p-3 text-muted-foreground">Divisão</th>
                                  <th className="text-left p-3 text-muted-foreground">Tipo</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Afastamento</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Prevista</th>
                                  <th className="text-left p-3 text-muted-foreground">Dias Restantes</th>
                                  <th className="text-left p-3 text-muted-foreground">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ativos.map((afastado) => {
                                  const diasRestantes = getDiasRestantes(afastado.data_retorno_prevista);
                                  return (
                                    <tr key={afastado.id} className="border-b">
                                      <td className="p-3">{afastado.registro_id}</td>
                                      <td className="p-3 font-medium">{afastado.nome_colete}</td>
                                      <td className="p-3">{afastado.divisao_texto}</td>
                                      <td className="p-3">{afastado.tipo_afastamento}</td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {diasRestantes < 0 ? (
                                          <Badge variant="destructive">{Math.abs(diasRestantes)}d atrasado</Badge>
                                        ) : diasRestantes <= 7 ? (
                                          <Badge className="bg-orange-500">{diasRestantes}d</Badge>
                                        ) : (
                                          <Badge variant="secondary">{diasRestantes}d</Badge>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        {(hasRole('admin') || hasRole('diretor_regional')) && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleAbrirModalBaixa(afastado)}
                                          >
                                            Registrar Saída
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sub-aba Histórico */}
                  <TabsContent value="historico">
                    <Card>
                      <CardHeader>
                        <CardTitle>Histórico de Afastamentos</CardTitle>
                        <CardDescription>
                          Todos os afastamentos registrados no sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loadingHistorico ? (
                          <p>Carregando...</p>
                        ) : historico.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            Nenhum registro encontrado
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-3 text-muted-foreground">Número</th>
                                  <th className="text-left p-3 text-muted-foreground">Nome</th>
                                  <th className="text-left p-3 text-muted-foreground">Divisão</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Afastamento</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Prevista</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Efetivo</th>
                                  <th className="text-left p-3 text-muted-foreground">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historico.map((afastado) => {
                                  const statusRetorno = getStatusRetorno(afastado.data_retorno_prevista, afastado.data_retorno_efetivo);
                                  return (
                                    <tr key={afastado.id} className="border-b">
                                      <td className="p-3">{afastado.registro_id}</td>
                                      <td className="p-3 font-medium">{afastado.nome_colete}</td>
                                      <td className="p-3">{afastado.divisao_texto}</td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {afastado.data_retorno_efetivo
                                          ? format(new Date(afastado.data_retorno_efetivo), 'dd/MM/yyyy', { locale: ptBR })
                                          : '-'}
                                      </td>
                                      <td className="p-3">
                                        {afastado.ativo ? (
                                          <Badge>Ativo</Badge>
                                        ) : statusRetorno ? (
                                          <Badge variant={statusRetorno.variant}>{statusRetorno.label}</Badge>
                                        ) : (
                                          <Badge variant="secondary">Finalizado</Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sub-aba Retornos Próximos */}
                  <TabsContent value="retornos">
                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Retornos nos Próximos 7 Dias</CardTitle>
                          <CardDescription>
                            Acompanhamento de retornos iminentes
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingProximos7 ? (
                            <p>Carregando...</p>
                          ) : proximos7.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              Nenhum retorno previsto para os próximos 7 dias
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {proximos7.map((afastado) => (
                                <div key={afastado.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <p className="font-medium">{afastado.nome_colete}</p>
                                    <p className="text-sm text-muted-foreground">{afastado.divisao_texto}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm">
                                      {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                    </p>
                                    <Badge className="bg-orange-500">
                                      {getDiasRestantes(afastado.data_retorno_prevista)} dias
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Retornos nos Próximos 30 Dias</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loadingProximos30 ? (
                            <p>Carregando...</p>
                          ) : (
                            <p className="text-2xl font-bold">{proximos30.length} retorno(s) previsto(s)</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Sub-aba Dashboard */}
                  <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Users className="h-8 w-8 text-primary" />
                            <div>
                              <div className="text-3xl font-bold">{totalAtivos}</div>
                              <p className="text-sm text-muted-foreground">Afastados Ativos</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-8 w-8 text-orange-500" />
                            <div>
                              <div className="text-3xl font-bold">{proximos7.length}</div>
                              <p className="text-sm text-muted-foreground">Retornos em 7 dias</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-blue-500" />
                            <div>
                              <div className="text-3xl font-bold">{proximos30.length}</div>
                              <p className="text-sm text-muted-foreground">Retornos em 30 dias</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                            <div>
                              <div className="text-3xl font-bold">{retornosAtrasados}</div>
                              <p className="text-sm text-muted-foreground">Retornos Atrasados</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Divisões Afetadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{divisoesAfetadas}</div>
                          <p className="text-sm text-muted-foreground">
                            divisão(ões) com integrantes afastados
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Total no Histórico</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{historico.length}</div>
                          <p className="text-sm text-muted-foreground">
                            afastamentos registrados (ativos e inativos)
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Aba Movimentações */}
              <TabsContent value="movimentacoes">
                <HistoricoMovimentacoes
                  nivelAcesso={escopo?.nivelAcesso || 'divisao'}
                  regionalUsuario={escopo?.regionalTexto || profile?.integrante?.regional_texto}
                  divisaoUsuario={escopo?.divisaoTexto || profile?.integrante?.divisao_texto}
                />
              </TabsContent>

            {hasAccessSemanalAba && (
              <TabsContent value="semanal">
                <RelatorioSemanalDivisaoAba />
              </TabsContent>
            )}
            </Tabs>
        )}

        {!relatorioData?.divisoes.length && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum dado disponível. Faça o upload de integrantes para gerar o relatório.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Baixa de Afastado */}
      <ModalBaixaAfastado
        open={modalBaixaOpen}
        onOpenChange={setModalBaixaOpen}
        afastado={afastadoSelecionado}
        onConfirm={handleConfirmarBaixa}
      />
    </div>
  );
};

export default Relatorios;
