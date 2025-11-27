import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ConfiguracaoTiposDelta } from "@/components/admin/ConfiguracaoTiposDelta";
import { ConfiguracaoAcoesResolucao } from "@/components/admin/ConfiguracaoAcoesResolucao";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { Settings, ArrowLeft } from "lucide-react";

const AdminConfiguracaoDeltas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Configuração de Deltas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os tipos de delta e suas ações de resolução
          </p>
        </div>
      </div>

      <Tabs defaultValue="tipos" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="tipos">Tipos de Delta</TabsTrigger>
          <TabsTrigger value="acoes">Ações de Resolução</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos">
          <ConfiguracaoTiposDelta />
        </TabsContent>

        <TabsContent value="acoes">
          <ConfiguracaoAcoesResolucao />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminConfiguracaoDeltas;
