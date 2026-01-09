import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenPermissionsBatch, getDefaultPermission } from "@/hooks/useScreenPermissionsBatch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, GraduationCap, Cake, Clock, FileEdit, History, ClipboardCheck, XCircle, List, Award, Image, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MensalidadesUploadCard } from "@/components/admin/MensalidadesUploadCard";
import { DashboardInadimplencia } from "@/components/relatorios/DashboardInadimplencia";
import { AniversariantesUploadCard } from "@/components/admin/AniversariantesUploadCard";
import { AniversariantesLista } from "@/components/admin/AniversariantesLista";
import { SolicitacaoTreinamento } from "@/components/admin/treinamento/SolicitacaoTreinamento";
import { HistoricoTreinamento } from "@/components/admin/treinamento/HistoricoTreinamento";
import { AprovacoesPendentes } from "@/components/admin/treinamento/AprovacoesPendentes";
import { EncerramentoTreinamento } from "@/components/admin/treinamento/EncerramentoTreinamento";
import { ListaIntegrantes } from "@/components/gestao/integrantes/ListaIntegrantes";
import { HistoricoAlteracoes } from "@/components/gestao/integrantes/HistoricoAlteracoes";
import { AtualizacaoIntegrantes } from "@/components/gestao/integrantes/AtualizacaoIntegrantes";
import { SolicitacaoEstagio } from "@/components/admin/estagio/SolicitacaoEstagio";
import { AprovacaoPendenteEstagio } from "@/components/admin/estagio/AprovacaoPendenteEstagio";
import { EncerramentoEstagio } from "@/components/admin/estagio/EncerramentoEstagio";
import { HistoricoEstagio } from "@/components/admin/estagio/HistoricoEstagio";
import { EstagioGrauV } from "@/components/admin/estagio/flyers/EstagioGrauV";
import { EstagioGrauVI } from "@/components/admin/estagio/flyers/EstagioGrauVI";
import { FilaProducao } from "@/components/admin/estagio/flyers/FilaProducao";

// Todas as rotas que precisamos verificar permissões
const ALL_ROUTES = [
  '/gestao-adm',
  '/gestao-adm-integrantes',
  '/gestao-adm-integrantes-lista',
  '/gestao-adm-integrantes-historico',
  '/gestao-adm-integrantes-atualizacao',
  '/gestao-adm-inadimplencia',
  '/gestao-adm-treinamento',
  '/gestao-adm-treinamento-solicitacao',
  '/gestao-adm-treinamento-aprovacao',
  '/gestao-adm-treinamento-encerramento',
  '/gestao-adm-treinamento-historico',
  '/gestao-adm-estagio',
  '/gestao-adm-estagio-solicitacao',
  '/gestao-adm-estagio-aprovacao',
  '/gestao-adm-estagio-encerramento',
  '/gestao-adm-estagio-historico',
  '/gestao-adm-estagio-flyers',
  '/gestao-adm-estagio-flyers-grau5',
  '/gestao-adm-estagio-flyers-grau6',
  '/gestao-adm-estagio-flyers-fila',
  '/gestao-adm-aniversariantes',
];

const GestaoADM = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Buscar todas as permissões em lote (2-3 queries em vez de 72+)
  const { permissions, loading } = useScreenPermissionsBatch(ALL_ROUTES, '/gestao-adm', user?.id);

  // Helper para obter permissão de uma rota
  const getPerm = (route: string) => permissions[route] || getDefaultPermission();

  // Permissões da página principal
  const hasAccess = getPerm('/gestao-adm').hasAnyAccess;

  // Permissões das abas principais
  const integrantesP = getPerm('/gestao-adm-integrantes');
  const inadimplenciaP = getPerm('/gestao-adm-inadimplencia');
  const treinamentoP = getPerm('/gestao-adm-treinamento');
  const estagioP = getPerm('/gestao-adm-estagio');
  const aniversariantesP = getPerm('/gestao-adm-aniversariantes');

  // Permissões das sub-abas de Integrantes
  const listaP = getPerm('/gestao-adm-integrantes-lista');
  const historicoIntegrantesP = getPerm('/gestao-adm-integrantes-historico');
  const atualizacaoP = getPerm('/gestao-adm-integrantes-atualizacao');

  // Permissões das sub-abas de Treinamento
  const solicitacaoP = getPerm('/gestao-adm-treinamento-solicitacao');
  const aprovacaoP = getPerm('/gestao-adm-treinamento-aprovacao');
  const encerramentoP = getPerm('/gestao-adm-treinamento-encerramento');
  const historicoTreinamentoP = getPerm('/gestao-adm-treinamento-historico');

  // Permissões das sub-abas de Estágio
  const solicitacaoEstagioP = getPerm('/gestao-adm-estagio-solicitacao');
  const aprovacaoEstagioP = getPerm('/gestao-adm-estagio-aprovacao');
  const encerramentoEstagioP = getPerm('/gestao-adm-estagio-encerramento');
  const historicoEstagioP = getPerm('/gestao-adm-estagio-historico');
  const flyersP = getPerm('/gestao-adm-estagio-flyers');

  // Permissões das sub-sub-abas de Flyers
  const grau5P = getPerm('/gestao-adm-estagio-flyers-grau5');
  const grau6P = getPerm('/gestao-adm-estagio-flyers-grau6');
  const filaP = getPerm('/gestao-adm-estagio-flyers-fila');

  // Montar lista de abas visíveis
  const visibleTabs = useMemo(() => {
    const allTabs = [
      { value: "integrantes", label: "Integrantes", icon: Users, hasAccess: integrantesP.hasAnyAccess },
      { value: "inadimplencia", label: "Inadimplência", icon: DollarSign, hasAccess: inadimplenciaP.hasAnyAccess },
      { value: "treinamento", label: "Treinamento", icon: GraduationCap, hasAccess: treinamentoP.hasAnyAccess },
      { value: "estagio", label: "Estágio", icon: Award, hasAccess: estagioP.hasAnyAccess },
      { value: "aniversariantes", label: "Aniversários", icon: Cake, hasAccess: aniversariantesP.hasAnyAccess },
    ];
    return allTabs.filter(tab => tab.hasAccess);
  }, [integrantesP.hasAnyAccess, inadimplenciaP.hasAnyAccess, treinamentoP.hasAnyAccess, estagioP.hasAnyAccess, aniversariantesP.hasAnyAccess]);

  // Montar lista de sub-abas de Integrantes visíveis
  const visibleIntegrantesSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "lista", label: "Lista", shortLabel: "Lista", icon: List, hasAccess: listaP.hasAnyAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: historicoIntegrantesP.hasAnyAccess },
      { value: "atualizacao", label: "Atualização", shortLabel: "Atual.", icon: RefreshCw, hasAccess: atualizacaoP.hasAnyAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [listaP.hasAnyAccess, historicoIntegrantesP.hasAnyAccess, atualizacaoP.hasAnyAccess]);

  // Montar lista de sub-abas de Treinamento visíveis
  const visibleTreinamentoSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "solicitacao", label: "Solicitação", shortLabel: "Solic.", icon: FileEdit, hasAccess: solicitacaoP.hasAnyAccess },
      { value: "pendentes", label: "Aprovação Pendente", shortLabel: "Aprov.", icon: ClipboardCheck, hasAccess: aprovacaoP.hasAnyAccess },
      { value: "encerramento", label: "Encerramento", shortLabel: "Enc.", icon: XCircle, hasAccess: encerramentoP.hasAnyAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: historicoTreinamentoP.hasAnyAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [solicitacaoP.hasAnyAccess, aprovacaoP.hasAnyAccess, encerramentoP.hasAnyAccess, historicoTreinamentoP.hasAnyAccess]);

  // Montar lista de sub-abas de Estágio visíveis
  const visibleEstagioSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "solicitacao", label: "Solicitação", shortLabel: "Solic.", icon: FileEdit, hasAccess: solicitacaoEstagioP.hasAnyAccess },
      { value: "pendentes", label: "Aprovação Pendente", shortLabel: "Aprov.", icon: ClipboardCheck, hasAccess: aprovacaoEstagioP.hasAnyAccess },
      { value: "encerramento", label: "Encerramento", shortLabel: "Enc.", icon: XCircle, hasAccess: encerramentoEstagioP.hasAnyAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: historicoEstagioP.hasAnyAccess },
      { value: "flyers", label: "Flyers", shortLabel: "Flyers", icon: Image, hasAccess: flyersP.hasAnyAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [solicitacaoEstagioP.hasAnyAccess, aprovacaoEstagioP.hasAnyAccess, encerramentoEstagioP.hasAnyAccess, historicoEstagioP.hasAnyAccess, flyersP.hasAnyAccess]);

  // Montar lista de sub-sub-abas de Flyers visíveis
  const visibleFlyersSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "grau5", label: "Estágio Grau V", shortLabel: "Grau V", hasAccess: grau5P.hasAnyAccess },
      { value: "grau6", label: "Estágio Grau VI", shortLabel: "Grau VI", hasAccess: grau6P.hasAnyAccess },
      { value: "fila", label: "Fila de Produção", shortLabel: "Fila", hasAccess: filaP.hasAnyAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [grau5P.hasAnyAccess, grau6P.hasAnyAccess, filaP.hasAnyAccess]);

  // Determinar aba inicial baseado no que o usuário tem acesso
  const initialMainTab = useMemo(() => {
    const urlTab = searchParams.get('mainTab');
    if (urlTab && visibleTabs.some(t => t.value === urlTab)) {
      return urlTab;
    }
    return visibleTabs[0]?.value || 'integrantes';
  }, [searchParams, visibleTabs]);

  const initialIntegrantesSubTab = useMemo(() => {
    return visibleIntegrantesSubTabs[0]?.value || 'lista';
  }, [visibleIntegrantesSubTabs]);

  const initialTreinamentoSubTab = useMemo(() => {
    const urlSubTab = searchParams.get('subTab');
    if (urlSubTab && visibleTreinamentoSubTabs.some(t => t.value === urlSubTab)) {
      return urlSubTab;
    }
    return visibleTreinamentoSubTabs[0]?.value || 'solicitacao';
  }, [searchParams, visibleTreinamentoSubTabs]);

  const initialEstagioSubTab = useMemo(() => {
    return visibleEstagioSubTabs[0]?.value || 'solicitacao';
  }, [visibleEstagioSubTabs]);

  const initialFlyersSubTab = useMemo(() => {
    return visibleFlyersSubTabs[0]?.value || 'grau5';
  }, [visibleFlyersSubTabs]);

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loading, hasAccess, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  // Se não tiver acesso a nenhuma aba, mostrar mensagem
  if (visibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Gestão ADM</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Sem permissões</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Você não tem permissão para acessar nenhuma funcionalidade desta página.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Gestão ADM</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Tabs defaultValue={initialMainTab} className="w-full">
          <TabsList className="w-full h-auto flex overflow-x-auto no-scrollbar bg-muted/50 p-1 gap-1">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 min-w-fit flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            {integrantesP.hasAnyAccess && (
              <TabsContent value="integrantes" className="m-0">
                {visibleIntegrantesSubTabs.length > 0 ? (
                  <Tabs defaultValue={initialIntegrantesSubTab} className="w-full">
                    <TabsList className={`w-full h-auto grid bg-muted/30 p-1 gap-1 mb-4`} style={{ gridTemplateColumns: `repeat(${visibleIntegrantesSubTabs.length}, 1fr)` }}>
                      {visibleIntegrantesSubTabs.map((subTab) => (
                        <TabsTrigger
                          key={subTab.value}
                          value={subTab.value}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          <subTab.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{subTab.label}</span>
                          <span className="sm:hidden">{subTab.shortLabel}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {listaP.hasAnyAccess && (
                      <TabsContent value="lista" className="m-0">
                        <ListaIntegrantes userId={user?.id} readOnly={listaP.isReadOnly || integrantesP.isReadOnly} />
                      </TabsContent>
                    )}

                    {historicoIntegrantesP.hasAnyAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoAlteracoes />
                      </TabsContent>
                    )}

                    {atualizacaoP.hasAnyAccess && (
                      <TabsContent value="atualizacao" className="m-0">
                        <AtualizacaoIntegrantes userId={user?.id} readOnly={atualizacaoP.isReadOnly || integrantesP.isReadOnly} />
                      </TabsContent>
                    )}
                  </Tabs>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Sem permissões</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Você não tem permissão para acessar nenhuma sub-aba de Integrantes.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {inadimplenciaP.hasAnyAccess && (
              <TabsContent value="inadimplencia" className="m-0">
                <div className="space-y-4">
                  <MensalidadesUploadCard readOnly={inadimplenciaP.isReadOnly} />
                  <DashboardInadimplencia userId={user?.id} readOnly={inadimplenciaP.isReadOnly} />
                </div>
              </TabsContent>
            )}

            {treinamentoP.hasAnyAccess && (
              <TabsContent value="treinamento" className="m-0">
                {visibleTreinamentoSubTabs.length > 0 ? (
                  <Tabs defaultValue={initialTreinamentoSubTab} className="w-full">
                    <TabsList className={`w-full h-auto grid bg-muted/30 p-1 gap-1 mb-4`} style={{ gridTemplateColumns: `repeat(${visibleTreinamentoSubTabs.length}, 1fr)` }}>
                      {visibleTreinamentoSubTabs.map((subTab) => (
                        <TabsTrigger
                          key={subTab.value}
                          value={subTab.value}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          <subTab.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{subTab.label}</span>
                          <span className="sm:hidden">{subTab.shortLabel}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {solicitacaoP.hasAnyAccess && (
                      <TabsContent value="solicitacao" className="m-0">
                        <SolicitacaoTreinamento userId={user?.id} readOnly={solicitacaoP.isReadOnly || treinamentoP.isReadOnly} />
                      </TabsContent>
                    )}

                    {aprovacaoP.hasAnyAccess && (
                      <TabsContent value="pendentes" className="m-0">
                        <AprovacoesPendentes userId={user?.id} readOnly={aprovacaoP.isReadOnly || treinamentoP.isReadOnly} />
                      </TabsContent>
                    )}

                    {encerramentoP.hasAnyAccess && (
                      <TabsContent value="encerramento" className="m-0">
                        <EncerramentoTreinamento userId={user?.id} readOnly={encerramentoP.isReadOnly || treinamentoP.isReadOnly} />
                      </TabsContent>
                    )}

                    {historicoTreinamentoP.hasAnyAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoTreinamento userId={user?.id} readOnly={historicoTreinamentoP.isReadOnly || treinamentoP.isReadOnly} />
                      </TabsContent>
                    )}
                  </Tabs>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Sem permissões</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Você não tem permissão para acessar nenhuma sub-aba de Treinamento.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {estagioP.hasAnyAccess && (
              <TabsContent value="estagio" className="m-0">
                {visibleEstagioSubTabs.length > 0 ? (
                  <Tabs defaultValue={initialEstagioSubTab} className="w-full">
                    <TabsList className={`w-full h-auto grid bg-muted/30 p-1 gap-1 mb-4`} style={{ gridTemplateColumns: `repeat(${visibleEstagioSubTabs.length}, 1fr)` }}>
                      {visibleEstagioSubTabs.map((subTab) => (
                        <TabsTrigger
                          key={subTab.value}
                          value={subTab.value}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          <subTab.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{subTab.label}</span>
                          <span className="sm:hidden">{subTab.shortLabel}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {solicitacaoEstagioP.hasAnyAccess && (
                      <TabsContent value="solicitacao" className="m-0">
                        <SolicitacaoEstagio userId={user?.id} readOnly={solicitacaoEstagioP.isReadOnly || estagioP.isReadOnly} />
                      </TabsContent>
                    )}

                    {aprovacaoEstagioP.hasAnyAccess && (
                      <TabsContent value="pendentes" className="m-0">
                        <AprovacaoPendenteEstagio userId={user?.id} readOnly={aprovacaoEstagioP.isReadOnly || estagioP.isReadOnly} />
                      </TabsContent>
                    )}

                    {encerramentoEstagioP.hasAnyAccess && (
                      <TabsContent value="encerramento" className="m-0">
                        <EncerramentoEstagio userId={user?.id} readOnly={encerramentoEstagioP.isReadOnly || estagioP.isReadOnly} />
                      </TabsContent>
                    )}

                    {historicoEstagioP.hasAnyAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoEstagio userId={user?.id} readOnly={historicoEstagioP.isReadOnly || estagioP.isReadOnly} />
                      </TabsContent>
                    )}

                    {flyersP.hasAnyAccess && (
                      <TabsContent value="flyers" className="m-0">
                        {visibleFlyersSubTabs.length > 0 ? (
                          <Tabs defaultValue={initialFlyersSubTab} className="w-full">
                            <TabsList className={`w-full h-auto grid bg-muted/20 p-1 gap-1 mb-4`} style={{ gridTemplateColumns: `repeat(${visibleFlyersSubTabs.length}, 1fr)` }}>
                              {visibleFlyersSubTabs.map((subTab) => (
                                <TabsTrigger
                                  key={subTab.value}
                                  value={subTab.value}
                                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                  <span className="hidden sm:inline">{subTab.label}</span>
                                  <span className="sm:hidden">{subTab.shortLabel}</span>
                                </TabsTrigger>
                              ))}
                            </TabsList>

                            {grau5P.hasAnyAccess && (
                              <TabsContent value="grau5" className="m-0">
                                <EstagioGrauV readOnly={grau5P.isReadOnly || flyersP.isReadOnly || estagioP.isReadOnly} />
                              </TabsContent>
                            )}

                            {grau6P.hasAnyAccess && (
                              <TabsContent value="grau6" className="m-0">
                                <EstagioGrauVI readOnly={grau6P.isReadOnly || flyersP.isReadOnly || estagioP.isReadOnly} />
                              </TabsContent>
                            )}

                            {filaP.hasAnyAccess && (
                              <TabsContent value="fila" className="m-0">
                                <FilaProducao readOnly={filaP.isReadOnly || flyersP.isReadOnly || estagioP.isReadOnly} />
                              </TabsContent>
                            )}
                          </Tabs>
                        ) : (
                          <Card className="border-border/50">
                            <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <h3 className="text-lg font-medium text-foreground mb-2">Sem permissões</h3>
                              <p className="text-sm text-muted-foreground max-w-xs">
                                Você não tem permissão para acessar nenhuma sub-aba de Flyers.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>
                    )}
                  </Tabs>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Sem permissões</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Você não tem permissão para acessar nenhuma sub-aba de Estágio.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {aniversariantesP.hasAnyAccess && (
              <TabsContent value="aniversariantes" className="m-0">
                <div className="space-y-4">
                  <AniversariantesUploadCard readOnly={aniversariantesP.isReadOnly} />
                  <AniversariantesLista userId={user?.id} />
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default GestaoADM;
