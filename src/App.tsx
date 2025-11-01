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
import Agenda from "./pages/Agenda";
import Relatorios from "./pages/Relatorios";
import Organograma from "./pages/Organograma";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosServico from "./pages/TermosServico";
import NotFound from "./pages/NotFound";

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
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/organograma" element={<Organograma />} />
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
