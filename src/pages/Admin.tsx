import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileStatus } from "@/types/profile";
import { ProfileDetailDialog } from "@/components/admin/ProfileDetailDialog";

interface Profile {
  id: string;
  name: string;
  nome_colete: string | null;
  profile_status: ProfileStatus;
  observacao: string | null;
  photo_url: string | null;
  created_at: string;
  comando_id: string | null;
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  funcao_id: string | null;
  data_entrada: string | null;
  grau: string | null;
  comandos?: { nome: string } | null;
  regionais?: { nome: string } | null;
  divisoes?: { nome: string } | null;
  cargos?: { nome: string } | null;
  funcoes?: { nome: string } | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { roles, hasRole, loading: roleLoading } = useUserRole(user?.uid);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'aprovar' | 'recusar' | 'inativar' | null>(null);
  const [observacao, setObservacao] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);

  // Verificar se e admin
  useEffect(() => {
    console.log('[Admin] Verificacao de acesso iniciada');
    console.log('[Admin] authLoading:', authLoading, 'roleLoading:', roleLoading);
    console.log('[Admin] user:', user?.uid);
    console.log('[Admin] roles:', roles);
    console.log('[Admin] hasRole(admin):', hasRole('admin'));
    
    // Esperar authLoading E roleLoading terminarem
    if (authLoading || roleLoading) {
      console.log('[Admin] Aguardando carregamento...');
      return;
    }
    
    // Se nao tem user, negar acesso
    if (!user) {
      console.log('[Admin] ACESSO NEGADO - sem usuario');
      toast({
        title: "Acesso Negado",
        description: "Voce precisa estar logado",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    
    // Verificar se e admin (sem setTimeout, roles como dependencia)
    if (!hasRole('admin')) {
      console.log('[Admin] ACESSO NEGADO - nao e admin. Roles:', roles);
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar esta area",
        variant: "destructive",
      });
      navigate("/");
    } else {
      console.log('[Admin] ACESSO PERMITIDO');
    }
  }, [user, roles, authLoading, roleLoading, navigate, toast]);

  // Carregar perfis
  useEffect(() => {
    fetchProfiles();

    // Realtime updates
    const channel = supabase
      .channel('admin-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchProfiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          comandos:comando_id (nome),
          regionais:regional_id (nome),
          divisoes:divisao_id (nome),
          cargos:cargo_id (nome),
          funcoes:funcao_id (nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data || []) as Profile[]);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar perfis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (profile: Profile, action: 'aprovar' | 'recusar' | 'inativar') => {
    setSelectedProfile(profile);
    setActionType(action);
    setObservacao(profile.observacao || "");
    setDialogOpen(true);
  };

  const openDetailDialog = (profile: Profile) => {
    setDetailProfile(profile);
    setDetailDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedProfile || !actionType || !user) return;

    // Validar observacao para recusa
    if (actionType === 'recusar' && !observacao.trim()) {
      toast({
        title: "Erro",
        description: "Informe o motivo da recusa",
        variant: "destructive",
      });
      return;
    }

    try {
      const updates: Partial<Profile> = {};

      switch (actionType) {
        case 'aprovar':
          updates.profile_status = 'Ativo';
          updates.observacao = observacao.trim() || null;
          break;
        case 'recusar':
          updates.profile_status = 'Recusado';
          updates.observacao = observacao.trim();
          break;
        case 'inativar':
          updates.profile_status = 'Inativo';
          updates.observacao = observacao.trim() || null;
          break;
      }

      // Chamar edge function passando o Firebase UID
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-update-profile`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_user_id: user.uid,
            profile_id: selectedProfile.id,
            ...updates,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil');
      }

      toast({
        title: "Sucesso",
        description: `Perfil ${actionType === 'aprovar' ? 'aprovado' : actionType === 'recusar' ? 'recusado' : 'inativado'} com sucesso`,
      });

      setDialogOpen(false);
      setSelectedProfile(null);
      setObservacao("");
      setActionType(null);
      fetchProfiles(); // Recarregar perfis
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao atualizar perfil",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
    'Pendente': { variant: 'secondary' as const, label: 'Pendente' },
    'Analise': { variant: 'secondary' as const, label: 'Em Analise' },
      'Ativo': { variant: 'default' as const, label: 'Ativo' },
      'Recusado': { variant: 'destructive' as const, label: 'Recusado' },
      'Inativo': { variant: 'outline' as const, label: 'Inativo' }
    };
    return config[status];
  };

  const filterByStatus = (status: string) => {
    return profiles.filter(p => p.profile_status === status);
  };

  const ProfileCard = ({ profile }: { profile: Profile }) => {
    const statusBadge = getStatusBadge(profile.profile_status);
    
    return (
      <Card className="mb-3 hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar className="w-14 h-14 flex-shrink-0 self-center sm:self-start">
              <AvatarImage src={profile.photo_url || ''} />
              <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-foreground">
                  {profile.nome_colete || profile.name}
                </h4>
                <Badge variant={statusBadge.variant}>
                  {statusBadge.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{profile.name}</p>
              {(profile.comandos?.nome || profile.regionais?.nome || profile.divisoes?.nome || profile.cargos?.nome) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {[
                    profile.comandos?.nome,
                    profile.regionais?.nome,
                    profile.divisoes?.nome,
                    profile.cargos?.nome
                  ].filter(Boolean).join(' • ')}
                </p>
              )}
              {profile.observacao && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Obs: {profile.observacao}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-shrink-0">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openDetailDialog(profile)}
                className="w-full sm:w-auto"
              >
                Ver Detalhes
              </Button>
              {profile.profile_status === 'Analise' && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => openDialog(profile, 'aprovar')}
                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  >
                    Aprovar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => openDialog(profile, 'recusar')}
                    className="w-full sm:w-auto"
                  >
                    Recusar
                  </Button>
                </>
              )}
              {profile.profile_status === 'Ativo' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => openDialog(profile, 'inativar')}
                  className="w-full sm:w-auto"
                >
                  Inativar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading || authLoading || roleLoading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="admin-page min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Administracao de Perfis</h1>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/admin/estrutura")} variant="outline" className="flex-1 sm:flex-none">
              Gestao de Estrutura
            </Button>
            <Button onClick={() => navigate("/admin/dados")} variant="outline" className="flex-1 sm:flex-none">
              Gestao de Dados
            </Button>
            <Button onClick={() => navigate("/admin/integrantes")} variant="outline" className="flex-1 sm:flex-none">
              Gestao de Integrantes
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="flex-1 sm:flex-none">
              Voltar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="analise" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="analise">
                Em Analise ({filterByStatus('Analise').length})
              </TabsTrigger>
            <TabsTrigger value="ativo">
              Ativos ({filterByStatus('Ativo').length})
            </TabsTrigger>
            <TabsTrigger value="pendente">
              Pendentes ({filterByStatus('Pendente').length})
            </TabsTrigger>
            <TabsTrigger value="recusado">
              Recusados ({filterByStatus('Recusado').length})
            </TabsTrigger>
            <TabsTrigger value="inativo">
              Inativos ({filterByStatus('Inativo').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analise" className="mt-4">
            {filterByStatus('Analise').map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
            {filterByStatus('Analise').length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum perfil aguardando analise
              </p>
            )}
          </TabsContent>

          <TabsContent value="ativo" className="mt-4">
            {filterByStatus('Ativo').map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </TabsContent>

          <TabsContent value="pendente" className="mt-4">
            {filterByStatus('Pendente').map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </TabsContent>

          <TabsContent value="recusado" className="mt-4">
            {filterByStatus('Recusado').map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </TabsContent>

          <TabsContent value="inativo" className="mt-4">
            {filterByStatus('Inativo').map(profile => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </TabsContent>
        </Tabs>

        {/* Dialog de Acao */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'aprovar' && 'Aprovar Perfil'}
                {actionType === 'recusar' && 'Recusar Perfil'}
                {actionType === 'inativar' && 'Inativar Membro'}
              </DialogTitle>
              <DialogDescription>
                {selectedProfile?.nome_colete || selectedProfile?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Observacao {actionType === 'recusar' && '(obrigatoria)'}
              </label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                  placeholder={
                    actionType === 'recusar' 
                      ? "Digite o motivo da recusa..."
                      : "Adicione uma observacao (opcional)..."
                  }
                className="min-h-[100px]"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAction}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Detalhes */}
        <ProfileDetailDialog
          profile={detailProfile}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onSuccess={fetchProfiles}
        />
      </div>
    </div>
  );
};

export default Admin;
