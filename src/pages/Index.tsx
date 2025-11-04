import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/hooks/usePresence";
import { OnlineUsersModal } from "@/components/OnlineUsersModal";
import { removeAccents } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, X } from "lucide-react";
import { useState, useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);
  const { onlineUsers, totalOnline } = usePresence(user?.id, profile?.nome_colete);
  const [showQRCode, setShowQRCode] = useState(false);

  const isLoggedIn = !!user;
  const isLoadingProfile = isLoggedIn && profileLoading;
  
  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (isLoggedIn && !profileLoading && profile && !profile.nome_colete) {
      console.log('[Index] Usuário sem nome_colete, redirecionando para perfil...');
      toast({
        title: "Complete seu cadastro",
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [isLoggedIn, profileLoading, profile, navigate, toast]);
  
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
  //   userId: user?.id
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
  const isDiretorDivisao = hasRole('diretor_divisao');
  const isModerator = hasRole('moderator');
  const isActive = profile?.profile_status === 'Ativo';
  const isProfileIncomplete = isLoggedIn && !profile?.nome_colete;

  // DEBUG: Log roles para diagnóstico
  console.log('🔐 Roles Debug:', {
    userId: user?.id,
    roleLoading,
    isAdmin,
    isModerator,
    isDiretorDivisao,
    isActive,
    profileStatus: profile?.profile_status
  });

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

  const handleListasPresenca = () => {
    navigate("/listas-presenca");
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
          <div className="flex justify-center items-center mb-4 relative">
            <div 
              className="w-32 h-32 rounded-full bg-secondary border-2 border-border bg-cover bg-center"
              style={{
                backgroundImage: userPhoto 
                  ? `url(${userPhoto})` 
                  : `url('/images/skull.png')`
              }}
            />
            {isLoggedIn && profile?.id && (
              <button
                onClick={() => setShowQRCode(true)}
                className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transition-all hover:scale-110"
                title="Ver QR Code"
              >
                <QrCode className="w-5 h-5" />
              </button>
            )}
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
            
            {!roleLoading && (isAdmin || isDiretorDivisao || isModerator) && (
              <Button 
                onClick={handleRelatorios}
                disabled={!isLoggedIn || !isActive}
                className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Relatorios
              </Button>
            )}
            
            {!roleLoading && (isAdmin || isModerator) && (
              <Button 
                onClick={handleListasPresenca}
                disabled={!isLoggedIn || !isActive}
                className="w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Listas de Presenca
              </Button>
            )}
          </div>

          {/* Footer - dentro do card, no bottom */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="text-center text-xs text-muted-foreground space-y-2">
            <div>2025 - {new Date().getFullYear()}</div>
            <div>🔐 Autenticacao segura via Google OAuth</div>
          </div>
        </div>
        </div>
      </div>

      {/* Modal de QR Code */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent 
          className="max-w-[90vw] w-full max-h-[90vh] h-auto p-6 bg-background border-border"
          onClick={() => setShowQRCode(false)}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Meu QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-6 py-6">
            <div className="bg-white p-6 rounded-xl">
              <QRCodeSVG 
                value={profile?.id || ""} 
                size={Math.min(window.innerWidth * 0.7, 400)}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              ID: {profile?.id}
            </p>
            <Button 
              onClick={() => setShowQRCode(false)} 
              variant="outline"
              className="w-full max-w-xs"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
