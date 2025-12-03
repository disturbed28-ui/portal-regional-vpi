import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, BarChart3, User, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FrequenciaDashboard } from "@/components/listas/FrequenciaDashboard";
import { ListasConsulta } from "@/components/listas/ListasConsulta";
import { FrequenciaIndividual } from "@/components/listas/FrequenciaIndividual";
import { ConfiguracaoJustificativas } from "@/components/listas/ConfiguracaoJustificativas";
import { ConfiguracaoTiposEvento } from "@/components/listas/ConfiguracaoTiposEvento";
import { getNivelAcesso } from "@/lib/grauUtils";

const ListasPresenca = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/listas-presenca', user?.id);

  const isAdmin = hasRole('admin');
  const isDiretorRegional = hasRole('diretor_regional');
  
  // Quem pode editar configurações: Admin ou Diretor Regional
  const canEditConfig = isAdmin || isDiretorRegional;
  
  // Determinar nível de acesso baseado no grau
  const nivelAcesso = getNivelAcesso(profile?.grau);

  // Gerar subtítulo dinâmico baseado no escopo
  const getSubtitulo = () => {
    if (isAdmin) return "Visualização completa de todas as divisões";
    if (nivelAcesso === 'comando') return "Visualização completa (CMD)";
    if (nivelAcesso === 'regional') return `Visualização da Regional ${profile?.regional || ''}`;
    if (nivelAcesso === 'divisao') return `Visualização da ${profile?.divisao || ''}`;
    return "Visualização limitada";
  };

  // Redirecionar se não tiver acesso
  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  // Loading da verificação de permissões
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

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-secondary shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Listas de Presença</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1 truncate">
              {getSubtitulo()}
            </p>
          </div>
        </div>

        {/* Tabs de Navegação */}
        <Tabs defaultValue="consulta" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4 h-auto">
            <TabsTrigger value="consulta" className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm">Consultar Listas</span>
              <span className="sm:hidden text-xs">Listas</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm">Dashboard</span>
              <span className="sm:hidden text-xs">Dash</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3">
              <User className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm">Frequência Individual</span>
              <span className="sm:hidden text-xs">Freq.</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3">
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs sm:text-sm">Configurações</span>
              <span className="sm:hidden text-xs">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consulta" className="mt-6">
            <ListasConsulta 
              grau={profile?.grau}
              regionalId={profile?.regional_id}
              divisaoId={profile?.divisao_id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <FrequenciaDashboard 
              grau={profile?.grau}
              regionalId={profile?.regional_id}
              divisaoId={profile?.divisao_id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="individual" className="mt-6">
            <FrequenciaIndividual 
              grau={profile?.grau}
              regionalId={profile?.regional_id}
              divisaoId={profile?.divisao_id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="config" className="mt-6 space-y-6">
            <ConfiguracaoJustificativas readOnly={!canEditConfig} />
            <ConfiguracaoTiposEvento readOnly={!canEditConfig} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ListasPresenca;
