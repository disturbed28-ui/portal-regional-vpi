import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CadastrarCandidato } from "@/components/expansao/CadastrarCandidato";
import { CandidatosList, EfetivadosList, HistoricoList } from "@/components/expansao/CandidatosTabs";

export default function Expansao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading } = useScreenAccess("/expansao", user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-[98vw] max-w-2xl px-2 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <UserPlus className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Expansão</h1>
        </div>

        <Tabs defaultValue="cadastrar" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="cadastrar" className="shrink-0">Cadastrar Candidato</TabsTrigger>
            <TabsTrigger value="candidatos" className="shrink-0">Candidatos</TabsTrigger>
            <TabsTrigger value="efetivados" className="shrink-0">Efetivados</TabsTrigger>
            <TabsTrigger value="historico" className="shrink-0">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastrar" className="mt-4">
            <CadastrarCandidato />
          </TabsContent>
          <TabsContent value="candidatos" className="mt-4">
            <CandidatosList />
          </TabsContent>
          <TabsContent value="efetivados" className="mt-4">
            <EfetivadosList />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <HistoricoList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
