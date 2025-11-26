import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, Bell, BarChart3 } from "lucide-react";
import AlertasInadimplencia from "@/components/admin/AlertasInadimplencia";

const AdminAlertas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading } = useScreenAccess('/admin/alertas', user?.id);
  const [activeTab, setActiveTab] = useState("enviar");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <Bell className="h-6 w-6 text-destructive" />
              Alertas de Inadimplência
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie alertas automáticos para devedores acima de 70 dias
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="enviar" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Enviar Alertas
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-6">
            <AlertasInadimplencia />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📊 Dashboard de Alertas</CardTitle>
                <CardDescription>
                  Visualize estatísticas e métricas dos alertas enviados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Dashboard em Desenvolvimento</p>
                  <p className="text-sm">
                    Em breve: gráficos de envios por dia, status, divisões mais alertadas e muito mais.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAlertas;
