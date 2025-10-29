import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.uid);
  const { hasRole, loading: roleLoading } = useUserRole(user?.uid);

  const isLoggedIn = !!user;
  const isLoadingProfile = isLoggedIn && profileLoading;
  
  const userName = isLoadingProfile 
    ? "Carregando..." 
    : (profile?.nome_colete || profile?.name || "Visitante");
  
  // DEBUG: Log state (comentado para evitar spam)
  // console.log('📊 Index state:', {
  //   isLoggedIn,
  //   profileLoading,
  //   profile,
  //   userName,
  //   userId: user?.uid
  // });
  
  // Mapeamento de status com cores e ícones
  const statusConfig = {
    'Pendente': { color: 'text-yellow-600', icon: '🟡', label: 'Pendente' },
    'Analise': { color: 'text-yellow-600', icon: '⏳', label: 'Em Analise' },
    'Ativo': { color: 'text-green-600', icon: '✅', label: 'Ativo' },
    'Recusado': { color: 'text-red-600', icon: '❌', label: 'Recusado' },
    'Inativo': { color: 'text-gray-500', icon: '⚫', label: 'Inativo' }
  };

  const profileStatus = profile?.profile_status || 'Pendente';
  const currentStatus = statusConfig[profileStatus as keyof typeof statusConfig] || statusConfig['Pendente'];

  const userStatus = isLoadingProfile
    ? "Carregando..."
    : isLoggedIn 
      ? `${profile?.status || 'Online'}/${currentStatus.label}` 
      : "Offline";
  
  const userPhoto = isLoadingProfile ? "" : (profile?.photo_url || "");
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
    if (!isLoggedIn) {
      toast({
        title: "Acesso Negado",
        description: "Voce precisa estar conectado para acessar seu perfil",
        variant: "destructive",
      });
      return;
    }
    navigate("/perfil");
  };

  const handleAdmin = () => {
    navigate("/admin");
  };

  const handleRefreshProfile = () => {
    window.location.reload();
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
            <p className={`text-sm font-medium ${isLoggedIn ? currentStatus.color : 'text-muted-foreground'}`}>
              {isLoggedIn && currentStatus.icon} {userStatus}
            </p>
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
              disabled={!isLoggedIn}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
            
            {isLoggedIn && userName === "Visitante" && (
              <Button 
                onClick={handleRefreshProfile}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white border border-border rounded-xl"
              >
                🔄 Recarregar Perfil (Debug)
              </Button>
            )}
          </div>

          {/* Footer - dentro do card, no bottom */}
          <div className="mt-auto pt-4 border-t border-border">
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <div>v2.1.0</div>
              <div>🔒 Autenticacao segura via Firebase (Google)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
