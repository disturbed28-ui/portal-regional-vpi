import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useScreenPermissionsBatch } from "@/hooks/useScreenPermissionsBatch";
import { useToast } from "@/hooks/use-toast";
import { useLinksUteis, useLinksUteisGrupos } from "@/hooks/useLinksUteis";
import { getIconeLink } from "@/lib/iconesLinksUteis";
import { ExternalLink, ArrowLeft } from "lucide-react";

const LinksUteis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useScreenAccess('/links-uteis', user?.id);
  const { grupos, loading: gruposLoading } = useLinksUteisGrupos(true);
  const { links, loading: linksLoading } = useLinksUteis(true);

  const gruposRoutes = useMemo(() => grupos.map(g => `/links-uteis/${g.slug}`), [grupos]);
  const { permissions: gruposPerms, loading: permsLoading } = useScreenPermissionsBatch(gruposRoutes, '/links-uteis', user?.id);

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user || !hasAccess) {
      toast({ title: "Acesso Negado", description: "Você não tem permissão para acessar esta página", variant: "destructive" });
      navigate("/");
    }
  }, [user, hasAccess, authLoading, accessLoading, navigate, toast]);

  const handleLinkClick = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const gruposVisiveis = useMemo(() => {
    return grupos
      .filter(g => gruposPerms[`/links-uteis/${g.slug}`]?.hasAnyAccess)
      .map(g => ({ grupo: g, links: links.filter(l => l.grupo_id === g.id) }))
      .filter(item => item.links.length > 0);
  }, [grupos, links, gruposPerms]);

  const isLoading = authLoading || accessLoading || gruposLoading || linksLoading || permsLoading;

  if (authLoading || accessLoading) {
    return <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center"><div className="text-white">Verificando permissões...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Links Úteis</h1>
        </div>

        {isLoading && <div className="text-center py-12 text-white">Carregando links...</div>}

        {!isLoading && gruposVisiveis.length === 0 && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400">Nenhum link disponível no momento.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && gruposVisiveis.length > 0 && (
          <Accordion type="multiple" className="space-y-3">
            {gruposVisiveis.map(({ grupo, links: grupoLinks }) => {
              const Icon = getIconeLink(grupo.icone);
              return (
                <AccordionItem key={grupo.id} value={grupo.id} className="bg-gray-800/50 border-gray-700 border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline text-white py-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{grupo.nome}</span>
                      <span className="text-xs text-gray-400">({grupoLinks.length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-1">
                      {grupoLinks.map(link => (
                        <Card
                          key={link.id}
                          className="bg-gray-900/60 border-gray-700 hover:bg-gray-900/80 transition-colors cursor-pointer"
                          onClick={() => handleLinkClick(link.url)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-base font-medium text-white">{link.titulo}</h3>
                              <ExternalLink className="h-4 w-4 text-gray-400 ml-4 flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <div className="fixed bottom-4 left-0 right-0 px-4 max-w-md mx-auto">
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Voltar à Home</Button>
        </div>
      </div>
    </div>
  );
};

export default LinksUteis;
