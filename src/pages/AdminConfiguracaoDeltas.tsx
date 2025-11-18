import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfiguracaoTiposDelta } from "@/components/admin/ConfiguracaoTiposDelta";
import { ConfiguracaoAcoesResolucao } from "@/components/admin/ConfiguracaoAcoesResolucao";
import { Settings } from "lucide-react";

const AdminConfiguracaoDeltas = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Configuração de Deltas</h1>
          <p className="text-muted-foreground">
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
