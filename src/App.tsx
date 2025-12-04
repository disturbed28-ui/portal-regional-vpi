import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import AdminEstrutura from "./pages/AdminEstrutura";
import AdminDados from "./pages/AdminDados";
import AdminIntegrantes from "./pages/AdminIntegrantes";
import AdminPermissoes from "./pages/AdminPermissoes";
import AdminAlertas from "./pages/AdminAlertas";
import AdminLinksUteis from "./pages/AdminLinksUteis";
import AdminConfiguracaoDeltas from "./pages/AdminConfiguracaoDeltas";
import AdminLogs from "./pages/AdminLogs";
import AdminGestaoAcoesSociais from "./pages/AdminGestaoAcoesSociais";
import Agenda from "./pages/Agenda";
import Relatorios from "./pages/Relatorios";
import Organograma from "./pages/Organograma";
import ListasPresenca from "./pages/ListasPresenca";
import LinksUteis from "./pages/LinksUteis";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosServico from "./pages/TermosServico";
import NotFound from "./pages/NotFound";
import AdminFormularios from "./pages/AdminFormularios";
import Formularios from "./pages/Formularios";
import FormularioRelatorioSemanal from "./pages/FormularioRelatorioSemanal";
import FormularioAcoesSociais from "./pages/FormularioAcoesSociais";
import AcoesSociais from "./pages/AcoesSociais";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/estrutura" element={<AdminEstrutura />} />
          <Route path="/admin/dados" element={<AdminDados />} />
          <Route path="/admin/integrantes" element={<AdminIntegrantes />} />
          <Route path="/admin/permissoes" element={<AdminPermissoes />} />
          <Route path="/admin/alertas" element={<AdminAlertas />} />
          <Route path="/admin/links-uteis" element={<AdminLinksUteis />} />
          <Route path="/admin/configuracao-deltas" element={<AdminConfiguracaoDeltas />} />
          <Route path="/admin/acoes-sociais" element={<AdminGestaoAcoesSociais />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/organograma" element={<Organograma />} />
          <Route path="/listas-presenca" element={<ListasPresenca />} />
          <Route path="/links-uteis" element={<LinksUteis />} />
          <Route path="/admin/formularios" element={<AdminFormularios />} />
          <Route path="/formularios" element={<Formularios />} />
          <Route path="/formularios/relatorio-semanal-divisao" element={<FormularioRelatorioSemanal />} />
          <Route path="/formularios/acoes_sociais" element={<FormularioAcoesSociais />} />
          <Route path="/acoes-sociais" element={<AcoesSociais />} />
          <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
          <Route path="/termos-servico" element={<TermosServico />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
