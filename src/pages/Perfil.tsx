import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

const Perfil = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [nomeColete, setNomeColete] = useState("");
  const [telefone, setTelefone] = useState("");
  
  // Carregar nome_colete existente do perfil
  useEffect(() => {
    if (profile?.nome_colete) {
      setNomeColete(profile.nome_colete);
    }
    if (profile?.telefone) {
      setTelefone(profile.telefone);
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
  const userName = profile?.name || user?.user_metadata?.full_name || "Visitante";
  const userEmail = user?.email || "Sem email";
  const userPhoto = profile?.photo_url || user?.user_metadata?.avatar_url || "";

  const handleEnviar = async () => {
    if (!nomeColete.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome de colete.",
        variant: "destructive",
      });
      return;
    }

    if (!telefone.trim()) {
      toast({
        title: "Erro",
        description: "Digite um telefone celular.",
        variant: "destructive",
      });
      return;
    }

    // Apenas mudar status se for Pendente ou Recusado
    // Usuários Ativo/Inativo mantêm seu status
    const currentStatus = profile?.profile_status || 'Pendente';
    const newStatus = (currentStatus === 'Ativo' || currentStatus === 'Inativo') 
      ? currentStatus 
      : 'Analise';

    try {
      // Chamar edge function em vez de UPDATE direto
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          user_id: user?.id,
          nome_colete: nomeColete.trim(),
          telefone: telefone.trim(),
          profile_status: newStatus
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso",
        description: currentStatus === 'Ativo' || currentStatus === 'Inativo'
          ? "Telefone atualizado com sucesso"
          : profile?.profile_status === 'Recusado'
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

  const integrante = profile?.integrante;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Cabeçalho com foto, nome e email */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold text-foreground">Meu Perfil</h1>
              <Button 
                onClick={() => navigate("/")}
                variant="outline"
                size="sm"
              >
                Voltar
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-full bg-secondary border border-border bg-cover bg-center flex-shrink-0"
                style={{
                  backgroundImage: userPhoto 
                    ? `url(${userPhoto})` 
                    : `url('/images/skull.png')`
                }}
              />
              <div className="flex-1">
                <h2 className="text-lg font-medium text-foreground">{userName}</h2>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensagem de Status */}
        {statusMessage && (
          <Card className={
            statusMessage.type === 'success' ? 'border-green-500 bg-muted' :
            statusMessage.type === 'warning' ? 'border-yellow-500 bg-muted' :
            statusMessage.type === 'error' ? 'border-destructive bg-destructive/10' :
            statusMessage.type === 'info' ? 'border-blue-500 bg-muted' :
            'border-border'
          }>
            <CardContent className="p-4">
              <p className={`text-sm font-medium ${
                statusMessage.type === 'success' ? 'text-green-600 dark:text-green-400' :
                statusMessage.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                statusMessage.type === 'error' ? 'text-destructive' :
                statusMessage.type === 'info' ? 'text-blue-700 dark:text-blue-300' :
                'text-foreground'
              }`}>
                {statusMessage.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Accordion com seções */}
        <Accordion type="multiple" defaultValue={["basicos", "estrutura"]} className="space-y-2">
          
          {/* 1. DADOS BÁSICOS (editáveis) */}
          <Card>
            <AccordionItem value="basicos" className="border-none">
              <AccordionTrigger className="px-6 hover:no-underline">
                <span className="text-base font-medium">📧 Dados Básicos</span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {/* Nome de Colete (editável) */}
                  <div>
                    <Label htmlFor="nomeColete" className="text-sm font-medium">
                      Nome de Colete
                    </Label>
                    <Input
                      id="nomeColete"
                      type="text"
                      placeholder="Digite seu nome de colete..."
                      value={nomeColete}
                      onChange={(e) => setNomeColete(e.target.value)}
                      disabled={profile?.profile_status === 'Ativo' || profile?.profile_status === 'Inativo'}
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Telefone (editável) */}
                  <div>
                    <Label htmlFor="telefone" className="text-sm font-medium">
                      Telefone Celular
                    </Label>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Status (somente leitura) */}
                  <div>
                    <Label className="text-sm font-medium">Status do Perfil</Label>
                    <div className="mt-1">
                      <Badge variant={
                        profile?.profile_status === 'Ativo' ? 'default' :
                        profile?.profile_status === 'Pendente' ? 'secondary' :
                        profile?.profile_status === 'Analise' ? 'secondary' :
                        'outline'
                      }>
                        {profile?.profile_status || 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>

          {/* 2. ESTRUTURA ORGANIZACIONAL */}
          <Card>
            <AccordionItem value="estrutura" className="border-none">
              <AccordionTrigger className="px-6 hover:no-underline">
                <span className="text-base font-medium">🏢 Estrutura Organizacional</span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Comando</Label>
                    <p className="text-sm mt-1">{profile?.comando || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Regional</Label>
                    <p className="text-sm mt-1">{profile?.regional || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Divisão</Label>
                    <p className="text-sm mt-1">{profile?.divisao || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cargo</Label>
                    <p className="text-sm mt-1">{profile?.cargo || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Função</Label>
                    <p className="text-sm mt-1">{profile?.funcao || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Grau</Label>
                    <p className="text-sm mt-1">{profile?.grau || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Data de Entrada</Label>
                    <p className="text-sm mt-1">
                      {profile?.data_entrada 
                        ? new Date(profile.data_entrada).toLocaleDateString('pt-BR')
                        : '—'
                      }
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>

          {/* 3. DADOS DO INTEGRANTE (só aparece se vinculado) */}
          {integrante?.vinculado && (
            <Card>
              <AccordionItem value="integrante" className="border-none">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <span className="text-base font-medium">🏍️ Dados do Integrante</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-4">
                    
                    {/* Veículos */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Veículos</Label>
                      <div className="flex gap-2">
                        <Badge variant={integrante.tem_moto ? "default" : "secondary"}>
                          {integrante.tem_moto ? '✅' : '❌'} Moto
                        </Badge>
                        <Badge variant={integrante.tem_carro ? "default" : "secondary"}>
                          {integrante.tem_carro ? '✅' : '❌'} Carro
                        </Badge>
                      </div>
                    </div>

                    {/* Funções Especiais (só mostra as que são true) */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Funções/Características Especiais
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {integrante.sgt_armas && <Badge>🎖️ Sgt Armas</Badge>}
                        {integrante.caveira && <Badge>💀 Caveira</Badge>}
                        {integrante.caveira_suplente && <Badge>💀 Caveira Suplente</Badge>}
                        {integrante.batedor && <Badge>🏍️ Batedor</Badge>}
                        {integrante.ursinho && <Badge>🐻 Ursinho</Badge>}
                        {integrante.lobo && <Badge>🐺 Lobo</Badge>}
                        {integrante.combate_insano && <Badge>⚔️ Combate Insano</Badge>}
                        
                        {/* Se nenhuma for true */}
                        {!integrante.sgt_armas && !integrante.caveira && 
                         !integrante.caveira_suplente && !integrante.batedor && 
                         !integrante.ursinho && !integrante.lobo && 
                         !integrante.combate_insano && (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma função especial atribuída
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cargo Estágio */}
                    {integrante.cargo_estagio && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Cargo Estágio</Label>
                        <p className="text-sm mt-1">{integrante.cargo_estagio}</p>
                      </div>
                    )}

                    {/* Status Ativo/Inativo */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Status do Integrante</Label>
                      <div className="mt-1">
                        <Badge variant={integrante.ativo ? "default" : "secondary"}>
                          {integrante.ativo ? '✅ Ativo' : '❌ Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Card>
          )}

        </Accordion>

        {/* Botão de Salvar */}
        <Card>
          <CardContent className="p-4">
            <Button 
              onClick={handleEnviar}
              className="w-full"
            >
              💾 Salvar Alterações
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Perfil;
