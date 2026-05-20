import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { ArrowLeft } from "lucide-react";
import { GruposManager } from "@/components/admin/links-uteis/GruposManager";
import { LinksManager } from "@/components/admin/links-uteis/LinksManager";

const AdminLinksUteis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para acessar esta página.", variant: "destructive" });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  if (loadingAccess) {
    return <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center"><div className="text-white">Verificando permissões...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex-1">
              <CardTitle className="text-2xl">Gestão de Links Úteis</CardTitle>
              <CardDescription>Organize links por grupos, configure ícones e ordem.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="grupos" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="grupos">Grupos</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>
            <TabsContent value="grupos" className="mt-6"><GruposManager /></TabsContent>
            <TabsContent value="links" className="mt-6"><LinksManager /></TabsContent>
          </Tabs>

          <div className="mt-8">
            <Button variant="outline" onClick={() => navigate("/admin")}>Voltar ao Painel Admin</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLinksUteis;
