import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Perfil = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nomeColete, setNomeColete] = useState("");
  
  // Dados mockados do usuário (será substituído por dados reais)
  const userName = "Usuario Teste";
  const userEmail = "usuario@example.com";
  const userPhoto = "";

  const handleEnviar = async () => {
    if (!nomeColete.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome de colete.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Aqui será implementada a chamada à API
      toast({
        title: "Sucesso",
        description: "✅ Enviado com sucesso",
      });
      setNomeColete("");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[360px]">
        {/* Container com mesmo tamanho do index */}
        <div className="bg-card border border-border rounded-3xl p-6">
          {/* Cabeçalho */}
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
              className="w-full bg-input border-border text-foreground rounded-xl"
            />
          </div>

          {/* Botão Enviar */}
          <div className="flex justify-end">
            <Button 
              onClick={handleEnviar}
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl px-6"
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
