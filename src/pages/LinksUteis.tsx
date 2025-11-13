import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useToast } from "@/hooks/use-toast";
import { useLinksUteis } from "@/hooks/useLinksUteis";
import { ExternalLink, ArrowLeft } from "lucide-react";

const LinksUteis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useScreenAccess('/links-uteis', user?.id);
  const { links, loading: linksLoading } = useLinksUteis(true);

  useEffect(() => {
    if (authLoading || accessLoading) return;

    if (!user || !hasAccess) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, hasAccess, authLoading, accessLoading, navigate, toast]);

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white">Verificando permissões...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Links Úteis</h1>
        </div>

        {linksLoading && (
          <div className="text-center py-12 text-white">
            Carregando links...
          </div>
        )}

        {!linksLoading && links.length === 0 && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400">
                Nenhum link útil disponível no momento.
              </p>
            </CardContent>
          </Card>
        )}

        {!linksLoading && links.length > 0 && (
          <div className="space-y-3">
            {links.map((link) => (
              <Card 
                key={link.id}
                className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer"
                onClick={() => handleLinkClick(link.url)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {link.titulo}
                      </h3>
                      <p className="text-sm text-gray-400 break-all">
                        {link.url}
                      </p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="fixed bottom-4 left-0 right-0 px-4 max-w-md mx-auto">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Voltar à Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LinksUteis;
