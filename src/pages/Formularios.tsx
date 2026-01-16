import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useFormulariosUsuario } from "@/hooks/useFormulariosCatalogo";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useUserRole } from "@/hooks/useUserRole";

// Tipo de roles de negócio válidas
type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao' | 'adm_regional' | 'comando';

// Constante com roles de negócio válidas
const APP_ROLES: AppRole[] = ['admin', 'moderator', 'diretor_regional', 'diretor_divisao', 'regional', 'social_divisao', 'adm_divisao', 'adm_regional', 'comando', 'user'];

const Formularios = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess("/formularios", user?.id);
  
  // Obter roles do usuário
  const { roles: userRoles, loading: loadingRoles } = useUserRole(user?.id);
  
  // Filtrar apenas roles de negócio (ignorar roles legadas)
  const userAppRoles: string[] = userRoles.filter((role): role is AppRole => APP_ROLES.includes(role as AppRole));
  
  console.log('[Formularios] User roles brutas:', userRoles);
  console.log('[Formularios] User app roles filtradas:', userAppRoles);
  
  // T5: Obter regionalId do perfil do usuário
  const regionalId = profile?.regional_id || null;
  
  // T5: Listar formulários ativos da regional
  const { data: formularios, isLoading } = useFormulariosUsuario(regionalId);

  /**
   * Verifica se o usuário pode acessar um formulário baseado em roles_permitidas
   * @param form - Formulário a ser verificado
   * @returns true se o usuário tem acesso, false caso contrário
   */
  const canAccessForm = (form: any): boolean => {
    // Regra 1: Se roles_permitidas for null ou array vazio, libera acesso para todos da regional
    if (!form.roles_permitidas || form.roles_permitidas.length === 0) {
      console.log(`[Formularios] Formulário "${form.titulo}" sem restrição de roles (acesso liberado)`);
      return true;
    }

    // Regra 2: Verifica se usuário tem pelo menos uma das roles permitidas
    const hasRequiredRole = form.roles_permitidas.some((role: string) => userAppRoles.includes(role));
    
    console.log(`[Formularios] Formulário "${form.titulo}" requer roles:`, form.roles_permitidas);
    console.log(`[Formularios] Usuário tem acesso:`, hasRequiredRole);
    
    return hasRequiredRole;
  };

  if (loadingAccess || isLoading || loadingRoles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground mb-4">
            Você não tem permissão para acessar esta página.
          </p>
          <Button onClick={() => navigate("/")}>Voltar</Button>
        </Card>
      </div>
    );
  }

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "link_interno":
        return <Badge variant="default">Interno</Badge>;
      case "url_externa":
        return <Badge variant="secondary">Google Forms</Badge>;
      case "builder":
        return <Badge variant="outline">Builder</Badge>;
      default:
        return null;
    }
  };

  const handleResponder = (formulario: any) => {
    // T5: Navegação condicional baseada no tipo
    if (formulario.tipo === "link_interno") {
      navigate(formulario.link_interno);
    } else if (formulario.tipo === "url_externa") {
      window.open(formulario.url_externa, "_blank");
    } else if (formulario.tipo === "builder") {
      navigate(`/formularios/builder/${formulario.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Formulários</h1>
            <p className="text-sm text-muted-foreground">
              Regional: {profile?.regional || "Carregando..."}
            </p>
          </div>
        </div>

        {/* Cards de formulários */}
        {(() => {
          // Filtrar formulários baseado em roles_permitidas
          const formulariosFiltrados = formularios?.filter(form => canAccessForm(form)) || [];
          
          console.log(`[Formularios] Total de formulários da regional: ${formularios?.length || 0}`);
          console.log(`[Formularios] Formulários após filtro de roles: ${formulariosFiltrados.length}`);

          return formulariosFiltrados.length > 0 ? (
            <div className="grid gap-4">
              {formulariosFiltrados.map((form) => (
                <Card key={form.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">{form.titulo}</h3>
                        {getTipoBadge(form.tipo)}
                      </div>
                      {form.descricao && (
                        <p className="text-sm text-muted-foreground mb-4">{form.descricao}</p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Periodicidade: {form.periodicidade}</span>
                        <span>
                          {form.limite_respostas === "unica" ? "1 resposta por período" : "Respostas ilimitadas"}
                        </span>
                      </div>
                    </div>
                    <Button onClick={() => handleResponder(form)}>
                      Responder
                      {form.tipo === "url_externa" && <ExternalLink className="h-4 w-4 ml-2" />}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum formulário disponível</h3>
              <p className="text-sm text-muted-foreground">
                {formularios && formularios.length > 0 
                  ? "Não há formulários disponíveis para o seu perfil no momento."
                  : "Não há formulários ativos para a sua regional no momento."
                }
              </p>
            </Card>
          );
        })()}
      </div>
    </div>
  );
};

export default Formularios;
