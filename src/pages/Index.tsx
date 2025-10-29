import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.uid);
  const { hasRole, loading: roleLoading } = useUserRole(user?.uid);

  const isLoggedIn = !!user;
  const userName = profile?.name || "Visitante";
  const userStatus = isLoggedIn ? "Online" : "Offline";
  const userPhoto = profile?.photo_url || "";
  const isAdmin = hasRole('admin');

  const handleConnect = () => {
    signInWithGoogle();
  };

  const handleDisconnect = () => {
    signOut();
  };

  const handleAgenda = () => {
    console.log("Agenda");
  };

  const handleOrganograma = () => {
    console.log("Organograma");
  };

  const handlePerfil = () => {
    navigate("/perfil");
  };

  const handleAdmin = () => {
    console.log("Administração");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[360px] flex flex-col">
        {/* Container principal com altura fixa */}
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col">
          {/* Cabeçalho */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-wider">
              PORTAL REGIONAL
            </h1>
            <h2 className="text-lg text-muted-foreground tracking-wide">
              VALE DO PARAIBA I - SP
            </h2>
          </div>

          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div 
              className="w-32 h-32 rounded-full bg-secondary border-2 border-border bg-cover bg-center"
              style={{
                backgroundImage: userPhoto 
                  ? `url(${userPhoto})` 
                  : `url('/images/skull.png')`
              }}
            />
          </div>

          {/* Nome e Status */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-foreground mb-1">
              {userName}
            </h3>
            <p className="text-sm text-muted-foreground">{userStatus}</p>
          </div>

          {/* Botões - todos com o mesmo tamanho */}
          <div className="flex flex-col gap-3 mb-6">
            <Button 
              onClick={isLoggedIn ? handleDisconnect : handleConnect}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
            >
              {isLoggedIn ? "Desconectar" : "Conectar"}
            </Button>
            
            <Button 
              onClick={handleAgenda}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
            >
              Agenda
            </Button>
            
            <Button 
              onClick={handleOrganograma}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
            >
              Organograma
            </Button>
            
            <Button 
              onClick={handlePerfil}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
            >
              Perfil do Usuario
            </Button>
            
            {isAdmin && (
              <Button 
                onClick={handleAdmin}
                className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
              >
                Administracao
              </Button>
            )}
          </div>

          {/* Footer - dentro do card, no bottom */}
          <div className="mt-auto pt-4 border-t border-border">
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <div>v2.1.0</div>
              <div>🔒 Autenticação segura via Firebase (Google)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
