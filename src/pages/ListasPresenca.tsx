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

const ListasPresenca = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/listas-presenca', user?.id);

  const isAdmin = hasRole('admin');
  const isModerator = hasRole('moderator');

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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Listas de Presença</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Visualização completa de todas as divisões" : "Visualização da sua divisão"}
            </p>
          </div>
        </div>

        {/* Tabs de Navegação */}
        <Tabs defaultValue="consulta" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="consulta" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Consultar Listas
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Frequência Individual
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consulta" className="mt-6">
            <ListasConsulta 
              isAdmin={isAdmin}
              userDivisaoId={profile?.divisao_id}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <FrequenciaDashboard 
              isAdmin={isAdmin}
              userDivisaoId={profile?.divisao_id}
            />
          </TabsContent>

          <TabsContent value="individual" className="mt-6">
            <FrequenciaIndividual 
              isAdmin={isAdmin}
              userDivisaoId={profile?.divisao_id}
            />
          </TabsContent>

          <TabsContent value="config" className="mt-6 space-y-6">
            <ConfiguracaoJustificativas readOnly={!isAdmin} />
            <ConfiguracaoTiposEvento readOnly={!isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ListasPresenca;
