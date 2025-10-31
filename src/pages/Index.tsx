import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/hooks/usePresence";
import { OnlineUsersModal } from "@/components/OnlineUsersModal";
import { removeAccents } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.uid);
  const { hasRole, loading: roleLoading } = useUserRole(user?.uid);
  const { onlineUsers, totalOnline } = usePresence(user?.uid, profile?.nome_colete);

  const isLoggedIn = !!user;
  const isLoadingProfile = isLoggedIn && profileLoading;
  
  const rawUserName = isLoadingProfile 
    ? "Carregando..." 
    : (profile?.nome_colete || profile?.name || "Visitante");
  
  const userName = rawUserName === "Carregando..." || rawUserName === "Visitante" 
    ? rawUserName 
    : removeAccents(rawUserName);
  
  // DEBUG: Log state (comentado para evitar spam)
  // console.log('📊 Index state:', {
  //   isLoggedIn,
  //   profileLoading,
  //   profile,
  //   userName,
  //   userId: user?.uid
  // });
  
  // Mapeamento de status com cores e icones
  const statusConfig = {
    'Pendente': { color: 'text-yellow-600', icon: '', label: 'Pendente' },
    'Analise': { color: 'text-yellow-600', icon: '', label: 'Em Analise' },
    'Ativo': { color: 'text-green-600', icon: '', label: 'Ativo' },
    'Recusado': { color: 'text-red-600', icon: '', label: 'Recusado' },
    'Inativo': { color: 'text-gray-500', icon: '', label: 'Inativo' }
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
  const isDiretorRegional = hasRole('diretor_regional');
  const isActive = profile?.profile_status === 'Ativo';
  const isProfileIncomplete = isLoggedIn && !profile?.nome_colete;

  const handleConnect = () => {
    signInWithGoogle();
  };

  const handleDisconnect = () => {
    signOut();
  };

  const handleAgenda = () => {
    navigate("/agenda");
  };

  const handleOrganograma = () => {
    navigate("/organograma");
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

  const handleRelatorios = () => {
    navigate("/relatorios");
  };


  return (
    <div className="landing-page min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[360px] flex flex-col">
        {/* Container principal com altura fixa */}
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col min-h-[600px]">
          {/* Cabecalho */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1" />
              <h1 className="text-2xl font-bold text-foreground tracking-wider">
                PORTAL REGIONAL
              </h1>
              <div className="flex-1 flex justify-end">
                {isLoggedIn && totalOnline > 0 && (
                  <OnlineUsersModal users={onlineUsers} totalOnline={totalOnline} />
                )}
              </div>
            </div>
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
            
            {/* Cargo */}
            {isLoggedIn && profile?.integrante?.cargo_nome && (
              <p className="text-sm text-muted-foreground mb-1">
                {removeAccents(profile.integrante.cargo_nome)}
                {profile.integrante.grau && ` (${removeAccents(profile.integrante.grau)})`}
              </p>
            )}
            
            {/* Divisão */}
            {isLoggedIn && profile?.integrante?.divisao_texto && (
              <p className="text-sm text-muted-foreground mb-1">
                {removeAccents(profile.integrante.divisao_texto)}
              </p>
            )}
            
            {/* Status com Vinculado */}
            <p className={`text-sm font-medium ${isLoggedIn ? currentStatus.color : 'text-muted-foreground'}`}>
              {userStatus}
              {isLoggedIn && profile?.integrante?.vinculado && (
                <span>/Vinculado</span>
              )}
            </p>
          </div>

          {/* Botoes - todos com o mesmo tamanho */}
          <div className="flex flex-col gap-3 mb-6">
            <Button 
              onClick={isLoggedIn ? handleDisconnect : handleConnect}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl"
            >
              {isLoggedIn ? "Desconectar" : "Conectar"}
            </Button>
            
            <Button 
              onClick={handleAgenda}
              disabled={!isLoggedIn || !isActive}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agenda
            </Button>
            
            <Button 
              onClick={handleOrganograma}
              disabled={!isLoggedIn || !isActive}
              className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Organograma
            </Button>
            
            <Button 
              onClick={handlePerfil}
              disabled={!isLoggedIn}
              className={`w-full h-12 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                isProfileIncomplete 
                  ? 'btn-pulse-warning font-bold' 
                  : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border'
              }`}
            >
              {isProfileIncomplete ? '⚠️ Complete seu Perfil!' : 'Perfil do Usuario'}
            </Button>
            
            {isAdmin && (
              <Button 
                onClick={handleAdmin}
                disabled={!isLoggedIn || !isActive}
                className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Administracao
              </Button>
            )}
            
            {(isAdmin || isDiretorRegional || hasRole('moderator')) && (
              <Button 
                onClick={handleRelatorios}
                disabled={!isLoggedIn || !isActive}
                className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Relatorios
              </Button>
            )}
          </div>

          {/* Footer - dentro do card, no bottom */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <div>2025 - {new Date().getFullYear()}</div>
            <div>🔐 Autenticacao segura via Firebase (Google)</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
