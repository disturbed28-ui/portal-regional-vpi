import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ConfiguracaoTiposDelta } from "@/components/admin/ConfiguracaoTiposDelta";
import { ConfiguracaoAcoesResolucao } from "@/components/admin/ConfiguracaoAcoesResolucao";
import { Settings, ArrowLeft } from "lucide-react";

const AdminConfiguracaoDeltas = () => {
  const navigate = useNavigate();

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
