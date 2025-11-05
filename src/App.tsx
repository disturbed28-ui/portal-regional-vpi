import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import ListasPresenca from "./pages/ListasPresenca";
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
          <Route path="/" element={
            <ProtectedRoute screenRoute="/">
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/perfil" element={
            <ProtectedRoute screenRoute="/perfil">
              <Perfil />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute screenRoute="/admin">
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/admin/estrutura" element={
            <ProtectedRoute screenRoute="/admin/estrutura">
              <AdminEstrutura />
            </ProtectedRoute>
          } />
          <Route path="/admin/dados" element={
            <ProtectedRoute screenRoute="/admin/dados">
              <AdminDados />
            </ProtectedRoute>
          } />
          <Route path="/admin/integrantes" element={
            <ProtectedRoute screenRoute="/admin/integrantes">
              <AdminIntegrantes />
            </ProtectedRoute>
          } />
          <Route path="/admin/permissoes" element={
            <ProtectedRoute screenRoute="/admin/permissoes">
              <AdminPermissoes />
            </ProtectedRoute>
          } />
          <Route path="/agenda" element={
            <ProtectedRoute screenRoute="/agenda">
              <Agenda />
            </ProtectedRoute>
          } />
          <Route path="/relatorios" element={
            <ProtectedRoute screenRoute="/relatorios">
              <Relatorios />
            </ProtectedRoute>
          } />
          <Route path="/organograma" element={
            <ProtectedRoute screenRoute="/organograma">
              <Organograma />
            </ProtectedRoute>
          } />
          <Route path="/listas-presenca" element={
            <ProtectedRoute screenRoute="/listas-presenca">
              <ListasPresenca />
            </ProtectedRoute>
          } />
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
