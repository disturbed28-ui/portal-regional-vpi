import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegistrarInsightTab, type EdicaoInsight } from "@/components/insights/RegistrarInsightTab";
import { HistoricoInsightsTab } from "@/components/insights/HistoricoInsightsTab";
import { ParticipacaoInsightsTab } from "@/components/insights/ParticipacaoInsightsTab";


/**
 * Controle de Insights — página interna vinculada ao módulo de Formulários.
 * O acesso é controlado pelo cadastro do Formulário Interno; aqui não há
 * segunda camada de autorização, apenas escopo de dados do usuário logado.
 */
const ControleInsights = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-3 py-3">
        <header className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/formularios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold leading-tight">Controle de Insights</h1>
          </div>
        </header>

        <Tabs defaultValue="registrar">
          <TabsList className="mb-3 grid w-full grid-cols-3">
            <TabsTrigger value="registrar" className="text-xs">Registrar</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
            <TabsTrigger value="participacao" className="text-xs">Participação</TabsTrigger>
          </TabsList>

          <TabsContent value="registrar">
            <RegistrarInsightTab />
          </TabsContent>
          <TabsContent value="historico">
            <HistoricoInsightsTab />
          </TabsContent>
          <TabsContent value="participacao">
            <ParticipacaoInsightsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ControleInsights;
