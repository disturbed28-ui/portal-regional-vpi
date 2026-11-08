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
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Instagram } from "lucide-react";
import { INSTAGRAM_NA } from "@/lib/instagramUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { validarCadastroPerfil, cadastroPerfilPendente } from "../../supabase/functions/_shared/cadastroPerfil";
import { CobrarAnaliseCard } from "@/components/perfil/CobrarAnaliseCard";

const Perfil = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/perfil', user?.id);
  const [nomeColete, setNomeColete] = useState("");
  const [telefone, setTelefone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [saving, setSaving] = useState(false);
  const [naoInformarInstagram, setNaoInformarInstagram] = useState(false);

  // Carregar dados existentes do perfil
  useEffect(() => {
    if (profile?.nome_colete) {
      setNomeColete(profile.nome_colete);
    }
    if (profile?.telefone) {
      setTelefone(profile.telefone);
    }
    if ((profile as any)?.instagram) {
      setInstagram(profile.instagram === INSTAGRAM_NA ? "" : profile.instagram);
      setNaoInformarInstagram(profile.instagram === INSTAGRAM_NA);
    }
  }, [profile]);

  const cadastroInicial = !!profile && cadastroPerfilPendente(profile);

  const getStatusMessage = () => {
    switch (profile?.profile_status) {
      case 'Pendente':
        return {
          type: 'info',
          message: 'Seu cadastro será encaminhado para análise após o envio.'
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
  
  // Redirecionar se nao estiver logado OU sem permissao
  useEffect(() => {
    // Primeiro: verificar autenticacao
    if (!authLoading && !user) {
      toast({
        title: "Acesso Negado",
        description: "Voce precisa estar conectado para acessar seu perfil",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    
    // Segundo: verificar permissao na matriz
    if (!loadingAccess && !hasAccess && user) {
      toast({
        title: "Acesso Negado",
        description: "Voce nao tem permissao para acessar esta pagina.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, authLoading, loadingAccess, hasAccess, navigate, toast]);

  // Dados reais do usuario
  const userName = profile?.name || user?.user_metadata?.full_name || "Visitante";
  const userEmail = user?.email || "Sem email";
  const userPhoto = profile?.photo_url || user?.user_metadata?.avatar_url || "";

  const handleEnviar = async () => {
    if (!user || saving) return;
    let dados;
    try {
      dados = validarCadastroPerfil({ nome_colete: nomeColete, telefone, instagram: naoInformarInstagram ? INSTAGRAM_NA : instagram });
    } catch (error) {
      toast({ title: "Confira seus dados", description: error instanceof Error ? error.message : "Dados inválidos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: { user_id: user.id, ...dados }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível salvar seu cadastro.');
      // A leitura do destino consulta os dados persistidos, sem depender do realtime.
      window.dispatchEvent(new CustomEvent('profile-saved', { detail: user.id }));
      toast({ title: cadastroInicial ? "Cadastro concluído" : "Dados atualizados", description: data.data?.profile_status === 'Analise' ? "Seu cadastro está aguardando análise." : "Seus dados foram salvos." });
      navigate("/", { replace: true });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const integrante = profile?.integrante;

  // Loading de autenticacao ou permissoes
  if (authLoading || loadingAccess || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {authLoading ? "Verificando autenticacao..." : "Verificando permissoes..."}
          </p>
        </div>
      </div>
    );
  }

  // Sem acesso, nao renderiza nada (useEffect ja redirecionou)
  if (!hasAccess) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Cabeçalho com foto, nome e email */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-semibold text-foreground">{cadastroInicial ? "Cadastro do integrante" : "Meu Perfil"}</h1>
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

        {/* Cobrança de análise do cadastro */}
        {user && (profile?.profile_status === 'Pendente' || profile?.profile_status === 'Analise') && (
          <CobrarAnaliseCard
            userId={user.id}
            nome={userName}
            nomeColete={profile?.nome_colete || nomeColete || null}
            telefone={profile?.telefone || telefone || null}
            email={userEmail}
            status={profile?.profile_status === 'Analise' ? 'Em análise' : 'Pendente'}
          />
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
                <fieldset disabled={saving} className="space-y-4">
                  {/* Nome de Colete (editável) */}
                  <div>
                    <Label htmlFor="nomeColete" className="text-sm font-medium">
                      Nome de Colete (obrigatório)
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
                      Celular / WhatsApp com DDD (obrigatório)
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

                  <div className="space-y-3">
                    <Label htmlFor="instagram" className="text-sm font-medium flex items-center gap-1.5">
                      <Instagram className="h-4 w-4" /> Instagram (opcional)
                    </Label>
                    <Input id="instagram" type="text" placeholder="@seuusuario" value={instagram}
                      disabled={naoInformarInstagram} autoCapitalize="none" autoCorrect="off" maxLength={32}
                      onChange={(e) => setInstagram(e.target.value)} />
                    <div className="flex items-start gap-2">
                      <Checkbox id="naoInformarInstagram" checked={naoInformarInstagram}
                        onCheckedChange={(checked) => setNaoInformarInstagram(checked === true)} />
                      <Label htmlFor="naoInformarInstagram" className="text-sm leading-5 cursor-pointer">
                        Não tenho Instagram / prefiro não informar
                      </Label>
                    </div>
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
                </fieldset>
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
              disabled={saving}
              className="w-full"
            >
              {saving ? "Salvando..." : cadastroInicial ? "Concluir cadastro" : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Perfil;
