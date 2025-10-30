import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

const Perfil = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.uid);
  const [nomeColete, setNomeColete] = useState("");
  
  // Carregar nome_colete existente do perfil
  useEffect(() => {
    if (profile?.nome_colete) {
      setNomeColete(profile.nome_colete);
    }
  }, [profile]);

  const getStatusMessage = () => {
    switch (profile?.profile_status) {
      case 'Pendente':
        return {
          type: 'info',
          message: 'Preencha seu nome de colete para solicitar entrada no clube'
        };
      case 'Analise':
        return {
          type: 'warning',
          message: 'Seu perfil esta em analise pelos administradores'
        };
      case 'Ativo':
        return {
          type: 'success',
          message: 'Voce e um membro ativo do clube!'
        };
      case 'Recusado':
        return {
          type: 'error',
          message: `Sua solicitacao foi recusada. Motivo: ${profile?.observacao || 'Nao informado'}`
        };
      case 'Inativo':
        return {
          type: 'neutral',
          message: 'Voce nao esta mais ativo no clube'
        };
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();
  
  // Redirecionar se nao estiver logado
  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Acesso Negado",
        description: "Voce precisa estar conectado para acessar seu perfil",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, loading, navigate, toast]);

  // Dados reais do usuario
  const userName = profile?.name || user?.displayName || "Visitante";
  const userEmail = user?.email || "Sem email";
  const userPhoto = profile?.photo_url || user?.photoURL || "";

  const handleEnviar = async () => {
    if (!nomeColete.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome de colete.",
        variant: "destructive",
      });
      return;
    }

    const newStatus = profile?.profile_status === 'Recusado' ? 'Analise' : 'Analise';

    try {
      // Chamar edge function em vez de UPDATE direto
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          userId: user?.uid,
          nome_colete: nomeColete.trim(),
          profile_status: newStatus
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso",
        description: profile?.profile_status === 'Recusado'
          ? "Solicitacao reenviada para analise"
          : "Nome de colete enviado para analise",
      });

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Falha ao enviar';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[360px] flex flex-col">
        {/* Container com mesmo tamanho do index */}
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col min-h-[600px]">
          {/* Cabecalho */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Perfil do Usuario
            </h2>
            <Button 
              onClick={() => navigate("/")}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              Fechar
            </Button>
          </div>

          {/* Foto e Nome */}
          <div className="flex items-center gap-4 mb-6">
            <div 
              className="w-14 h-14 rounded-full bg-secondary border border-border bg-cover bg-center flex-shrink-0"
              style={{
                backgroundImage: userPhoto 
                  ? `url(${userPhoto})` 
                  : `url('/images/skull.png')`
              }}
            />
            <div className="min-w-0 flex-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <div className="text-sm text-foreground truncate">{userName}</div>
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="text-sm text-foreground truncate">{userEmail}</div>
          </div>

          {/* Mensagem de Status */}
          {statusMessage && (
            <div className={`mb-4 p-3 rounded-lg border ${
              statusMessage.type === 'success' ? 'bg-green-50 border-green-200' :
              statusMessage.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              statusMessage.type === 'error' ? 'bg-red-50 border-red-200' :
              statusMessage.type === 'info' ? 'bg-blue-50 border-blue-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-sm ${
                statusMessage.type === 'success' ? 'text-green-700' :
                statusMessage.type === 'warning' ? 'text-yellow-700' :
                statusMessage.type === 'error' ? 'text-red-700' :
                statusMessage.type === 'info' ? 'text-blue-700' :
                'text-gray-700'
              }`}>
                {statusMessage.message}
              </p>
            </div>
          )}

          {/* Nome de Colete */}
          <div className="mb-6">
            <Label htmlFor="nomeColete" className="text-xs text-muted-foreground mb-2 block">
              Nome de Colete
            </Label>
            <Input
              id="nomeColete"
              type="text"
              placeholder="digite aqui..."
              value={nomeColete}
              onChange={(e) => setNomeColete(e.target.value)}
              disabled={profile?.profile_status === 'Ativo' || profile?.profile_status === 'Inativo'}
              className="w-full bg-input border-border text-foreground rounded-xl disabled:opacity-50"
            />
          </div>

          {/* Botao Enviar */}
          <div className="flex justify-end">
            <Button 
              onClick={handleEnviar}
              disabled={profile?.profile_status === 'Ativo' || profile?.profile_status === 'Inativo'}
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;
