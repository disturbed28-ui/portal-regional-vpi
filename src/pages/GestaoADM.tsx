import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useTabAccessLevel } from "@/hooks/useTabAccessLevel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, GraduationCap, Cake, Clock, FileEdit, History, ClipboardCheck, XCircle, List, Award, Image } from "lucide-react";
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
import { SolicitacaoEstagio } from "@/components/admin/estagio/SolicitacaoEstagio";
import { AprovacaoPendenteEstagio } from "@/components/admin/estagio/AprovacaoPendenteEstagio";
import { EncerramentoEstagio } from "@/components/admin/estagio/EncerramentoEstagio";
import { HistoricoEstagio } from "@/components/admin/estagio/HistoricoEstagio";
import { EstagioGrauV } from "@/components/admin/estagio/flyers/EstagioGrauV";
import { EstagioGrauVI } from "@/components/admin/estagio/flyers/EstagioGrauVI";
import { FilaProducao } from "@/components/admin/estagio/flyers/FilaProducao";

const GestaoADM = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Acesso à página principal
  const { hasAccess, loading } = useScreenAccess('/gestao-adm', user?.id);
  
  // Acesso às abas principais (com nível de acesso)
  const { hasAnyAccess: hasIntegrantesAccess, isReadOnly: integrantesReadOnly, loading: loadingIntegrantes } = useTabAccessLevel('/gestao-adm-integrantes', user?.id);
  const { hasAnyAccess: hasInadimplenciaAccess, isReadOnly: inadimplenciaReadOnly, loading: loadingInadimplencia } = useTabAccessLevel('/gestao-adm-inadimplencia', user?.id);
  const { hasAnyAccess: hasTreinamentoAccess, isReadOnly: treinamentoReadOnly, loading: loadingTreinamento } = useTabAccessLevel('/gestao-adm-treinamento', user?.id);
  const { hasAnyAccess: hasEstagioAccess, isReadOnly: estagioReadOnly, loading: loadingEstagio } = useTabAccessLevel('/gestao-adm-estagio', user?.id);
  const { hasAnyAccess: hasAniversariantesAccess, isReadOnly: aniversariantesReadOnly, loading: loadingAniversariantes } = useTabAccessLevel('/gestao-adm-aniversariantes', user?.id);
  
  // Acesso às sub-abas de Integrantes
  const { hasAnyAccess: hasListaAccess, isReadOnly: listaReadOnly, loading: loadingLista } = useTabAccessLevel('/gestao-adm-integrantes-lista', user?.id);
  const { hasAnyAccess: hasHistoricoIntegrantesAccess, isReadOnly: historicoIntegrantesReadOnly, loading: loadingHistoricoIntegrantes } = useTabAccessLevel('/gestao-adm-integrantes-historico', user?.id);
  
  // Acesso às sub-abas de Treinamento
  const { hasAnyAccess: hasSolicitacaoAccess, isReadOnly: solicitacaoReadOnly, loading: loadingSolicitacao } = useTabAccessLevel('/gestao-adm-treinamento-solicitacao', user?.id);
  const { hasAnyAccess: hasAprovacaoAccess, isReadOnly: aprovacaoReadOnly, loading: loadingAprovacao } = useTabAccessLevel('/gestao-adm-treinamento-aprovacao', user?.id);
  const { hasAnyAccess: hasEncerramentoAccess, isReadOnly: encerramentoReadOnly, loading: loadingEncerramento } = useTabAccessLevel('/gestao-adm-treinamento-encerramento', user?.id);
  const { hasAnyAccess: hasHistoricoTreinamentoAccess, isReadOnly: historicoTreinamentoReadOnly, loading: loadingHistoricoTreinamento } = useTabAccessLevel('/gestao-adm-treinamento-historico', user?.id);

  // Acesso às sub-abas de Estágio
  const { hasAnyAccess: hasSolicitacaoEstagioAccess, isReadOnly: solicitacaoEstagioReadOnly, loading: loadingSolicitacaoEstagio } = useTabAccessLevel('/gestao-adm-estagio-solicitacao', user?.id);
  const { hasAnyAccess: hasAprovacaoEstagioAccess, isReadOnly: aprovacaoEstagioReadOnly, loading: loadingAprovacaoEstagio } = useTabAccessLevel('/gestao-adm-estagio-aprovacao', user?.id);
  const { hasAnyAccess: hasEncerramentoEstagioAccess, isReadOnly: encerramentoEstagioReadOnly, loading: loadingEncerramentoEstagio } = useTabAccessLevel('/gestao-adm-estagio-encerramento', user?.id);
  const { hasAnyAccess: hasHistoricoEstagioAccess, isReadOnly: historicoEstagioReadOnly, loading: loadingHistoricoEstagio } = useTabAccessLevel('/gestao-adm-estagio-historico', user?.id);
  const { hasAnyAccess: hasFlyersAccess, isReadOnly: flyersReadOnly, loading: loadingFlyers } = useTabAccessLevel('/gestao-adm-estagio-flyers', user?.id);

  // Acesso às sub-sub-abas de Flyers
  const { hasAnyAccess: hasGrau5Access, isReadOnly: grau5ReadOnly, loading: loadingGrau5 } = useTabAccessLevel('/gestao-adm-estagio-flyers-grau5', user?.id);
  const { hasAnyAccess: hasGrau6Access, isReadOnly: grau6ReadOnly, loading: loadingGrau6 } = useTabAccessLevel('/gestao-adm-estagio-flyers-grau6', user?.id);
  const { hasAnyAccess: hasFilaAccess, isReadOnly: filaReadOnly, loading: loadingFila } = useTabAccessLevel('/gestao-adm-estagio-flyers-fila', user?.id);

  // Verificar se ainda está carregando
  const isLoading = loading || loadingIntegrantes || loadingInadimplencia || loadingTreinamento || 
                    loadingAniversariantes || loadingLista || loadingHistoricoIntegrantes || 
                    loadingSolicitacao || loadingAprovacao || loadingEncerramento || loadingHistoricoTreinamento ||
                    loadingEstagio || loadingSolicitacaoEstagio || loadingAprovacaoEstagio || 
                    loadingEncerramentoEstagio || loadingHistoricoEstagio || loadingFlyers ||
                    loadingGrau5 || loadingGrau6 || loadingFila;

  // Montar lista de abas visíveis
  const visibleTabs = useMemo(() => {
    const allTabs = [
      { value: "integrantes", label: "Integrantes", icon: Users, hasAccess: hasIntegrantesAccess },
      { value: "inadimplencia", label: "Inadimplência", icon: DollarSign, hasAccess: hasInadimplenciaAccess },
      { value: "treinamento", label: "Treinamento", icon: GraduationCap, hasAccess: hasTreinamentoAccess },
      { value: "estagio", label: "Estágio", icon: Award, hasAccess: hasEstagioAccess },
      { value: "aniversariantes", label: "Aniversários", icon: Cake, hasAccess: hasAniversariantesAccess },
    ];
    return allTabs.filter(tab => tab.hasAccess);
  }, [hasIntegrantesAccess, hasInadimplenciaAccess, hasTreinamentoAccess, hasEstagioAccess, hasAniversariantesAccess]);

  // Montar lista de sub-abas de Integrantes visíveis
  const visibleIntegrantesSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "lista", label: "Lista", shortLabel: "Lista", icon: List, hasAccess: hasListaAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: hasHistoricoIntegrantesAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [hasListaAccess, hasHistoricoIntegrantesAccess]);

  // Montar lista de sub-abas de Treinamento visíveis
  const visibleTreinamentoSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "solicitacao", label: "Solicitação", shortLabel: "Solic.", icon: FileEdit, hasAccess: hasSolicitacaoAccess },
      { value: "pendentes", label: "Aprovação Pendente", shortLabel: "Aprov.", icon: ClipboardCheck, hasAccess: hasAprovacaoAccess },
      { value: "encerramento", label: "Encerramento", shortLabel: "Enc.", icon: XCircle, hasAccess: hasEncerramentoAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: hasHistoricoTreinamentoAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [hasSolicitacaoAccess, hasAprovacaoAccess, hasEncerramentoAccess, hasHistoricoTreinamentoAccess]);

  // Montar lista de sub-abas de Estágio visíveis
  const visibleEstagioSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "solicitacao", label: "Solicitação", shortLabel: "Solic.", icon: FileEdit, hasAccess: hasSolicitacaoEstagioAccess },
      { value: "pendentes", label: "Aprovação Pendente", shortLabel: "Aprov.", icon: ClipboardCheck, hasAccess: hasAprovacaoEstagioAccess },
      { value: "encerramento", label: "Encerramento", shortLabel: "Enc.", icon: XCircle, hasAccess: hasEncerramentoEstagioAccess },
      { value: "historico", label: "Histórico", shortLabel: "Hist.", icon: History, hasAccess: hasHistoricoEstagioAccess },
      { value: "flyers", label: "Flyers", shortLabel: "Flyers", icon: Image, hasAccess: hasFlyersAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [hasSolicitacaoEstagioAccess, hasAprovacaoEstagioAccess, hasEncerramentoEstagioAccess, hasHistoricoEstagioAccess, hasFlyersAccess]);

  // Montar lista de sub-sub-abas de Flyers visíveis
  const visibleFlyersSubTabs = useMemo(() => {
    const allSubTabs = [
      { value: "grau5", label: "Estágio Grau V", shortLabel: "Grau V", hasAccess: hasGrau5Access },
      { value: "grau6", label: "Estágio Grau VI", shortLabel: "Grau VI", hasAccess: hasGrau6Access },
      { value: "fila", label: "Fila de Produção", shortLabel: "Fila", hasAccess: hasFilaAccess },
    ];
    return allSubTabs.filter(tab => tab.hasAccess);
  }, [hasGrau5Access, hasGrau6Access, hasFilaAccess]);

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

  if (isLoading) {
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
            {hasIntegrantesAccess && (
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

                    {hasListaAccess && (
                      <TabsContent value="lista" className="m-0">
                        <ListaIntegrantes userId={user?.id} readOnly={listaReadOnly || integrantesReadOnly} />
                      </TabsContent>
                    )}

                    {hasHistoricoIntegrantesAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoAlteracoes />
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

            {hasInadimplenciaAccess && (
              <TabsContent value="inadimplencia" className="m-0">
                <div className="space-y-4">
                  <MensalidadesUploadCard readOnly={inadimplenciaReadOnly} />
                  <DashboardInadimplencia userId={user?.id} readOnly={inadimplenciaReadOnly} />
                </div>
              </TabsContent>
            )}

            {hasTreinamentoAccess && (
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

                    {hasSolicitacaoAccess && (
                      <TabsContent value="solicitacao" className="m-0">
                        <SolicitacaoTreinamento userId={user?.id} readOnly={solicitacaoReadOnly || treinamentoReadOnly} />
                      </TabsContent>
                    )}

                    {hasAprovacaoAccess && (
                      <TabsContent value="pendentes" className="m-0">
                        <AprovacoesPendentes userId={user?.id} readOnly={aprovacaoReadOnly || treinamentoReadOnly} />
                      </TabsContent>
                    )}

                    {hasEncerramentoAccess && (
                      <TabsContent value="encerramento" className="m-0">
                        <EncerramentoTreinamento userId={user?.id} readOnly={encerramentoReadOnly || treinamentoReadOnly} />
                      </TabsContent>
                    )}

                    {hasHistoricoTreinamentoAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoTreinamento userId={user?.id} readOnly={historicoTreinamentoReadOnly || treinamentoReadOnly} />
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

            {hasEstagioAccess && (
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

                    {hasSolicitacaoEstagioAccess && (
                      <TabsContent value="solicitacao" className="m-0">
                        <SolicitacaoEstagio userId={user?.id} readOnly={solicitacaoEstagioReadOnly || estagioReadOnly} />
                      </TabsContent>
                    )}

                    {hasAprovacaoEstagioAccess && (
                      <TabsContent value="pendentes" className="m-0">
                        <AprovacaoPendenteEstagio userId={user?.id} readOnly={aprovacaoEstagioReadOnly || estagioReadOnly} />
                      </TabsContent>
                    )}

                    {hasEncerramentoEstagioAccess && (
                      <TabsContent value="encerramento" className="m-0">
                        <EncerramentoEstagio userId={user?.id} readOnly={encerramentoEstagioReadOnly || estagioReadOnly} />
                      </TabsContent>
                    )}

                    {hasHistoricoEstagioAccess && (
                      <TabsContent value="historico" className="m-0">
                        <HistoricoEstagio userId={user?.id} readOnly={historicoEstagioReadOnly || estagioReadOnly} />
                      </TabsContent>
                    )}

                    {hasFlyersAccess && (
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

                            {hasGrau5Access && (
                              <TabsContent value="grau5" className="m-0">
                                <EstagioGrauV readOnly={grau5ReadOnly || flyersReadOnly || estagioReadOnly} />
                              </TabsContent>
                            )}

                            {hasGrau6Access && (
                              <TabsContent value="grau6" className="m-0">
                                <EstagioGrauVI readOnly={grau6ReadOnly || flyersReadOnly || estagioReadOnly} />
                              </TabsContent>
                            )}

                            {hasFilaAccess && (
                              <TabsContent value="fila" className="m-0">
                                <FilaProducao readOnly={filaReadOnly || flyersReadOnly || estagioReadOnly} />
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

            {hasAniversariantesAccess && (
              <TabsContent value="aniversariantes" className="m-0">
                <div className="space-y-4">
                  <AniversariantesUploadCard readOnly={aniversariantesReadOnly} />
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
