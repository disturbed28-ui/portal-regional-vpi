import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ArrowLeft, Building2, Database, Users, ShieldCheck, Bell, Link as LinkIcon, FileCheck, TriangleAlert, Settings, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileStatus } from "@/types/profile";
import { ProfileDetailDialog } from "@/components/admin/ProfileDetailDialog";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

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
  integrante?: {
    vinculado: boolean;
  } | null;
  roles?: string[];
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { roles, hasRole, loading: roleLoading } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'aprovar' | 'recusar' | 'inativar' | null>(null);
  const [observacao, setObservacao] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ProfileStatus>('Analise');
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'moderator' | 'user'>('all');
  const [activeDivisionKey, setActiveDivisionKey] = useState<string | null>(null);

  // Função para buscar perfis
  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    try {
      // 1) Buscar perfis com joins e limit de 300
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          comandos:comando_id (nome),
          regionais:regional_id (nome),
          divisoes:divisao_id (nome),
          cargos:cargo_id (nome),
          funcoes:funcao_id (nome),
          integrante:integrantes_portal!integrantes_portal_profile_id_fkey(
            vinculado
          )
        `)
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      
      if (data && data.length > 0) {
        // 2) Montar lista de IDs
        const profileIds = data.map(profile => profile.id);
        
        // 3) Fazer UMA única query em user_roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', profileIds);
        
        if (rolesError) {
          console.error('Erro ao buscar roles:', rolesError);
        }
        
        // 4) Montar mapa de roles por user_id
        const rolesByUserId: Record<string, string[]> = {};
        if (rolesData) {
          rolesData.forEach(item => {
            if (!rolesByUserId[item.user_id]) {
              rolesByUserId[item.user_id] = [];
            }
            rolesByUserId[item.user_id].push(item.role);
          });
        }
        
        // 5) Montar array final de perfis
        const profilesWithRoles = data.map(profile => ({
          ...profile,
          integrante: Array.isArray(profile.integrante) 
            ? profile.integrante[0] 
            : profile.integrante,
          roles: rolesByUserId[profile.id] || []
        }));
        
        setProfiles(profilesWithRoles as Profile[]);
      } else {
        setProfiles([]);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar perfis",
        variant: "destructive",
      });
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Verificar se e admin
  useEffect(() => {
    console.log('[Admin] Verificacao de acesso iniciada');
    console.log('[Admin] authLoading:', authLoading, 'roleLoading:', roleLoading);
    console.log('[Admin] user:', user?.id);
    console.log('[Admin] roles:', roles);
    console.log('[Admin] hasRole(admin):', hasRole('admin'));
    
    if (authLoading || roleLoading) {
      console.log('[Admin] Aguardando carregamento...');
      return;
    }
    
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
    
    if (!hasRole('admin')) {
      console.log('[Admin] ACESSO NEGADO - nao e admin. Roles:', roles);
      logSystemEventFromClient({
        tipo: 'PERMISSION_DENIED',
        origem: 'frontend:Admin',
        rota: '/admin',
        mensagem: 'Tentativa de acesso a area admin sem permissao',
        detalhes: {
          userId: user.id,
          userRoles: roles
        }
      });
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar esta area",
        variant: "destructive",
      });
      navigate("/");
    } else {
      console.log('[Admin] ACESSO PERMITIDO');
    }
  }, [user, roles, authLoading, roleLoading, hasRole, navigate, toast]);

  // Buscar perfis quando tiver acesso confirmado
  useEffect(() => {
    if (!loadingAccess && hasAccess) {
      fetchProfiles();
      
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
    }
  }, [loadingAccess, hasAccess]);

  // Loading de permissões
  if (loadingAccess || authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  // Loading de dados
  if (loadingProfiles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfis...</p>
        </div>
      </div>
    );
  }

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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-update-profile`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_user_id: user.id,
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
      fetchProfiles();
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

  const filterByStatusAndRole = (status: ProfileStatus) => {
    let filtered = profiles.filter(p => p.profile_status === status);
    
    if (selectedRole !== 'all') {
      filtered = filtered.filter(p => 
        Array.isArray(p.roles) && p.roles.includes(selectedRole)
      );
    }
    
    return filtered;
  };

  const groupByDivision = (profiles: Profile[]): Record<string, Profile[]> => {
    const grouped: Record<string, Profile[]> = {};
    
    profiles.forEach(profile => {
      const divisionName = profile.divisoes?.nome || 'Sem Divisao';
      
      if (!grouped[divisionName]) {
        grouped[divisionName] = [];
      }
      
      grouped[divisionName].push(profile);
    });
    
    return grouped;
  };

  const DivisionHeader = ({ 
    divisionName, 
    count,
    isActive,
    onClick 
  }: { 
    divisionName: string; 
    count: number;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <div 
      onClick={onClick}
      className={`
        flex items-center justify-between p-4 rounded-lg border cursor-pointer
        transition-all hover:bg-accent hover:shadow-md
        ${isActive ? 'bg-accent border-primary' : 'bg-card border-border'}
      `}
    >
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-lg">{divisionName}</h3>
        <Badge variant="secondary" className="ml-2">
          {count} {count === 1 ? 'usuario' : 'usuarios'}
        </Badge>
      </div>
      
      <div className={`
        transition-transform duration-200
        ${isActive ? 'rotate-180' : 'rotate-0'}
      `}>
        <ChevronDown className="h-5 w-5" />
      </div>
    </div>
  );

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
                
                {profile.integrante?.vinculado ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                    Vinculado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    Nao Vinculado
                  </Badge>
                )}
                
                {Array.isArray(profile.roles) && profile.roles.length > 0 && (
                  profile.roles.map(role => {
                    const roleConfig = {
                      admin: { label: 'Admin', variant: 'destructive' as const },
                      moderator: { label: 'Moderador', variant: 'default' as const },
                      user: { label: 'Usuario', variant: 'secondary' as const },
                      diretor_divisao: { label: 'Diretor / Subdiretor de Divisao', variant: 'default' as const },
                    }[role] || { label: role, variant: 'outline' as const };
                    
                    return (
                      <Badge key={role} variant={roleConfig.variant}>
                        {roleConfig.label}
                      </Badge>
                    );
                  })
                )}
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

  return (
    <div className="admin-page min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header mobile-first com botao de voltar */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold sm:text-2xl">
            Administracao de Perfis
          </h1>
        </div>

        {/* Grid de botoes - pensado para 9x18 */}
        
<div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-3">

  <Button
    onClick={() => navigate("/admin/estrutura")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <Building2 className="h-4 w-4 mr-2" />
    Gestao de Estrutura
  </Button>

  <Button
    onClick={() => navigate("/admin/dados")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <Database className="h-4 w-4 mr-2" />
    Gestao de Dados
  </Button>

  <Button
    onClick={() => navigate("/admin/integrantes")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <Users className="h-4 w-4 mr-2" />
    Gestao de Integrantes
  </Button>

  <Button
    onClick={() => navigate("/admin/permissoes")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <ShieldCheck className="h-4 w-4 mr-2" />
    Gestao de Permissoes
  </Button>

  <Button
    onClick={() => navigate("/admin/alertas")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <Bell className="h-4 w-4 mr-2" />
    Alertas de Inadimplencia
  </Button>

  <Button
    onClick={() => navigate("/admin/links-uteis")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <LinkIcon className="h-4 w-4 mr-2" />
    Links Uteis
  </Button>

  <Button
    onClick={() => navigate("/admin/formularios")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <FileCheck className="h-4 w-4 mr-2" />
    Formularios
  </Button>

  <Button
    onClick={() => navigate("/admin/acoes-sociais/solicitacoes-exclusao")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <TriangleAlert className="h-4 w-4 mr-2" />
    Exclusoes de Acoes Sociais
  </Button>

  <Button
    onClick={() => navigate("/admin/configuracao-deltas")}
    variant="outline"
    className="w-full justify-start h-9 px-2 py-2 text-sm"
  >
    <Settings className="h-4 w-4 mr-2" />
    Configuracao de Deltas
  </Button>

            <Button
              onClick={() => navigate("/admin/logs")}
              variant="outline"
              className="w-full justify-start h-9 px-2 py-2 text-sm"
            >
              <Activity className="h-4 w-4 mr-2" />
              Auditoria
            </Button>
</div>


        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Filtrar por Status</label>
              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as ProfileStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Analise">
                    Em Analise ({filterByStatusAndRole('Analise').length})
                  </SelectItem>
                  <SelectItem value="Ativo">
                    Ativos ({filterByStatusAndRole('Ativo').length})
                  </SelectItem>
                  <SelectItem value="Pendente">
                    Pendentes ({filterByStatusAndRole('Pendente').length})
                  </SelectItem>
                  <SelectItem value="Recusado">
                    Recusados ({filterByStatusAndRole('Recusado').length})
                  </SelectItem>
                  <SelectItem value="Inativo">
                    Inativos ({filterByStatusAndRole('Inativo').length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Filtrar por Perfil de Acesso</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Perfis</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="moderator">Moderadores</SelectItem>
                  <SelectItem value="diretor_divisao">Diretores / Subdiretores de Divisao</SelectItem>
                  <SelectItem value="user">Usuarios Comuns</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Lista agrupada por divisao */}
          <div className="space-y-4">
            {(() => {
              const filteredProfiles = filterByStatusAndRole(selectedStatus);
              
              if (filteredProfiles.length === 0) {
                return (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum perfil encontrado com os filtros selecionados
                  </p>
                );
              }
              
              const groupedProfiles = groupByDivision(filteredProfiles);
              const sortedDivisions = Object.keys(groupedProfiles).sort();
              
              return sortedDivisions.map(divisionName => {
                const divisionProfiles = groupedProfiles[divisionName];
                const isActive = activeDivisionKey === divisionName;
                
                return (
                  <div key={divisionName} className="border rounded-lg overflow-hidden">
                    <DivisionHeader
                      divisionName={divisionName}
                      count={divisionProfiles.length}
                      isActive={isActive}
                      onClick={() => {
                        setActiveDivisionKey(isActive ? null : divisionName);
                      }}
                    />
                    
                    {isActive && (
                      <div className="p-4 space-y-3 bg-muted/30">
                        {divisionProfiles.map(profile => (
                          <ProfileCard key={profile.id} profile={profile} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Dialog de acao */}
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

        {/* Dialog de detalhes */}
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
