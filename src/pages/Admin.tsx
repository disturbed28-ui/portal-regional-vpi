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
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  data_entrada: string | null;
  grau: string | null;
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

  // Verificar se é admin
  useEffect(() => {
    console.log('[Admin] Verificação de acesso iniciada');
    console.log('[Admin] authLoading:', authLoading, 'roleLoading:', roleLoading);
    console.log('[Admin] user:', user?.uid);
    console.log('[Admin] roles:', roles);
    console.log('[Admin] hasRole(admin):', hasRole('admin'));
    
    // Esperar authLoading E roleLoading terminarem
    if (authLoading || roleLoading) {
      console.log('[Admin] Aguardando carregamento...');
      return;
    }
    
    // Se não tem user, negar acesso
    if (!user) {
      console.log('[Admin] ACESSO NEGADO - sem usuário');
      toast({
        title: "Acesso Negado",
        description: "Você precisa estar logado",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    
    // Verificar se é admin (sem setTimeout, roles como dependência)
    if (!hasRole('admin')) {
      console.log('[Admin] ACESSO NEGADO - não é admin. Roles:', roles);
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar esta área",
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
        .select('*')
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
    if (!selectedProfile || !actionType) return;

    // Validar observação para recusa
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

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Perfil ${actionType === 'aprovar' ? 'aprovado' : actionType === 'recusar' ? 'recusado' : 'inativado'} com sucesso`,
      });

      setDialogOpen(false);
      setSelectedProfile(null);
      setObservacao("");
      setActionType(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
    'Pendente': { variant: 'secondary' as const, label: '🟡 Pendente' },
    'Analise': { variant: 'secondary' as const, label: '⏳ Em Analise' },
      'Ativo': { variant: 'default' as const, label: '✅ Ativo' },
      'Recusado': { variant: 'destructive' as const, label: '❌ Recusado' },
      'Inativo': { variant: 'outline' as const, label: '⚫ Inativo' }
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
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14 flex-shrink-0">
              <AvatarImage src={profile.photo_url || ''} />
              <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-foreground">
                  {profile.nome_colete || profile.name}
                </h4>
                <Badge variant={statusBadge.variant}>
                  {statusBadge.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{profile.name}</p>
              {(profile.regional || profile.cargo) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {[profile.regional, profile.cargo].filter(Boolean).join(' • ')}
                </p>
              )}
              {profile.observacao && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Obs: {profile.observacao}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openDetailDialog(profile)}
              >
                Ver Detalhes
              </Button>
              {profile.profile_status === 'Analise' && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => openDialog(profile, 'aprovar')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Aprovar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => openDialog(profile, 'recusar')}
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Administracao de Perfis</h1>
          <Button onClick={() => navigate("/")} variant="outline">
            Voltar
          </Button>
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

        {/* Dialog de Ação */}
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
