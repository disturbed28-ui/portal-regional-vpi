import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, GraduationCap, Cake, Clock, FileEdit, History, ClipboardCheck, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MensalidadesUploadCard } from "@/components/admin/MensalidadesUploadCard";
import { DashboardInadimplencia } from "@/components/relatorios/DashboardInadimplencia";
import { AniversariantesUploadCard } from "@/components/admin/AniversariantesUploadCard";
import { AniversariantesLista } from "@/components/admin/AniversariantesLista";
import { SolicitacaoTreinamento } from "@/components/admin/treinamento/SolicitacaoTreinamento";
import { HistoricoTreinamento } from "@/components/admin/treinamento/HistoricoTreinamento";
import { AprovacoesPendentes } from "@/components/admin/treinamento/AprovacoesPendentes";
import { EncerramentoTreinamento } from "@/components/admin/treinamento/EncerramentoTreinamento";

const GestaoADM = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading } = useScreenAccess('/gestao-adm', user?.id);

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

  const tabs = [
    { value: "integrantes", label: "Integrantes", icon: Users },
    { value: "inadimplencia", label: "Inadimplência", icon: DollarSign },
    { value: "treinamento", label: "Treinamento", icon: GraduationCap },
    { value: "aniversariantes", label: "Aniversários", icon: Cake },
  ];

  const PlaceholderContent = ({ title }: { title: string }) => (
    <Card className="border-border/50">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Em breve</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          A funcionalidade de {title} está em desenvolvimento e estará disponível em breve.
        </p>
      </CardContent>
    </Card>
  );

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
        <Tabs defaultValue="integrantes" className="w-full">
          <TabsList className="w-full h-auto flex overflow-x-auto no-scrollbar bg-muted/50 p-1 gap-1">
            {tabs.map((tab) => (
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
            <TabsContent value="integrantes" className="m-0">
              <PlaceholderContent title="Integrantes" />
            </TabsContent>

            <TabsContent value="inadimplencia" className="m-0">
              <div className="space-y-4">
                {/* Bloco 1: Upload de Mensalidades */}
                <MensalidadesUploadCard />
                
                {/* Bloco 2: Visualização de Inadimplência */}
                <DashboardInadimplencia userId={user?.id} />
              </div>
            </TabsContent>

            <TabsContent value="treinamento" className="m-0">
              <Tabs defaultValue="solicitacao" className="w-full">
                <TabsList className="w-full h-auto grid grid-cols-4 bg-muted/30 p-1 gap-1 mb-4">
                  <TabsTrigger
                    value="solicitacao"
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <FileEdit className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Solicitação</span>
                    <span className="sm:hidden">Solic.</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="pendentes"
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Aprovação Pendente</span>
                    <span className="sm:hidden">Aprov.</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="encerramento"
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Encerramento</span>
                    <span className="sm:hidden">Enc.</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <History className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Histórico</span>
                    <span className="sm:hidden">Hist.</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="solicitacao" className="m-0">
                  <SolicitacaoTreinamento userId={user?.id} />
                </TabsContent>

                <TabsContent value="pendentes" className="m-0">
                  <AprovacoesPendentes userId={user?.id} />
                </TabsContent>

                <TabsContent value="encerramento" className="m-0">
                  <EncerramentoTreinamento userId={user?.id} />
                </TabsContent>

                <TabsContent value="historico" className="m-0">
                  <HistoricoTreinamento userId={user?.id} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="aniversariantes" className="m-0">
              <div className="space-y-4">
                <AniversariantesUploadCard />
                <AniversariantesLista userId={user?.id} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default GestaoADM;
