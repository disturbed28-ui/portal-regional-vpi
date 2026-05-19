import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ClipboardCheck, History, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AvaliacaoTab } from "@/components/avaliacao/AvaliacaoTab";
import { HistoricoAvaliacaoTab } from "@/components/avaliacao/HistoricoAvaliacaoTab";

const AvaliacaoIntegrantes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasAccess, loading: accessLoading } = useScreenAccess('/avaliacao-integrantes', user?.id);

  useEffect(() => {
    if (!accessLoading && !hasAccess) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para acessar esta tela.", variant: "destructive" });
      navigate("/");
    }
  }, [accessLoading, hasAccess, navigate]);

  const loading = accessLoading || profileLoading;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!hasAccess) return null;

  const regionalId = profile?.regional_id || null;
  const avaliadorNome = profile?.nome_colete || profile?.name || null;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-semibold">Avaliação de Integrantes</h1>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <AvaliacaoTabsController userId={user?.id} regionalId={regionalId} avaliadorNome={avaliadorNome} />
      </div>
    </div>
  );
};

function AvaliacaoTabsController({ userId, regionalId, avaliadorNome }: { userId: string | undefined; regionalId: string | null; avaliadorNome: string | null; }) {
  const [tab, setTab] = useState<'avaliacao' | 'historico'>('avaliacao');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'avaliacao' | 'historico')}>
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="avaliacao" className="gap-1.5"><ClipboardCheck className="h-4 w-4" />Avaliação</TabsTrigger>
        <TabsTrigger value="historico" className="gap-1.5"><History className="h-4 w-4" />Histórico</TabsTrigger>
      </TabsList>
      <TabsContent value="avaliacao" className="mt-4">
        <AvaliacaoTab
          userId={userId}
          regionalId={regionalId}
          avaliadorNome={avaliadorNome}
          onDecisaoRegionalConcluida={() => setTab('historico')}
        />
      </TabsContent>
      <TabsContent value="historico" className="mt-4">
        <HistoricoAvaliacaoTab userId={userId} regionalId={regionalId} />
      </TabsContent>
    </Tabs>);
}
      </div>
    </div>
  );
};

export default AvaliacaoIntegrantes;
