import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, Loader2, RefreshCw, ArrowLeft, 
  Settings, FileText, Users, Calendar, Heart, 
  Link2, ClipboardList, LayoutDashboard, GraduationCap,
  UserCog, Briefcase, ChevronRight, AlertTriangle
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ROLES = [
  { value: 'admin' as const, label: 'Admin', color: 'bg-red-500' },
  { value: 'moderator' as const, label: 'Moderador', color: 'bg-blue-500' },
  { value: 'comando' as const, label: 'Comando', color: 'bg-indigo-500' },
  { value: 'diretor_regional' as const, label: 'Diretor Regional', color: 'bg-green-500' },
  { value: 'adm_regional' as const, label: 'ADM Regional', color: 'bg-amber-500' },
  { value: 'regional' as const, label: 'Regional', color: 'bg-teal-500' },
  { value: 'diretor_divisao' as const, label: 'Diretor / Subdiretor de Divisão', color: 'bg-purple-500' },
  { value: 'social_divisao' as const, label: 'Social de Divisão', color: 'bg-pink-500' },
  { value: 'adm_divisao' as const, label: 'ADM de Divisão', color: 'bg-orange-500' },
  { value: 'user' as const, label: 'Usuário', color: 'bg-gray-500' },
];

interface SystemScreen {
  id: string;
  nome: string;
  rota: string;
  descricao?: string;
  ordem?: number;
}

interface ScreenGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  screens: SystemScreen[];
  subGroups?: { key: string; label: string; screens: SystemScreen[] }[];
}

// Função para agrupar telas por bloco e sub-bloco
function groupScreensByBlock(screens: SystemScreen[]): ScreenGroup[] {
  const groups: Record<string, ScreenGroup> = {};

  // Definição dos blocos principais
  const blockDefinitions: Record<string, { label: string; icon: React.ReactNode; order: number }> = {
    'gestao-adm': { label: 'Gestão ADM', icon: <Briefcase className="h-4 w-4" />, order: 1 },
    'admin': { label: 'Administração', icon: <Settings className="h-4 w-4" />, order: 2 },
    'relatorios': { label: 'Relatórios', icon: <FileText className="h-4 w-4" />, order: 3 },
    'acoes-sociais': { label: 'Ações Sociais', icon: <Heart className="h-4 w-4" />, order: 4 },
    'listas-presenca': { label: 'Listas de Presença', icon: <ClipboardList className="h-4 w-4" />, order: 5 },
    'agenda': { label: 'Agenda', icon: <Calendar className="h-4 w-4" />, order: 6 },
    'geral': { label: 'Páginas Gerais', icon: <LayoutDashboard className="h-4 w-4" />, order: 99 },
  };

  // Sub-blocos para Gestão ADM
  const gestaoAdmSubBlocks: Record<string, string> = {
    'estagio': 'Estágio',
    'treinamento': 'Treinamento',
    'integrantes': 'Integrantes',
    'inadimplencia': 'Inadimplência',
  };

  screens.forEach(screen => {
    const rota = screen.rota;
    let blockKey = 'geral';
    let subBlockKey: string | null = null;

    // Identificar bloco principal
    if (rota.startsWith('/gestao-adm')) {
      blockKey = 'gestao-adm';
      // Identificar sub-bloco
      const match = rota.match(/\/gestao-adm-(\w+)/);
      if (match && gestaoAdmSubBlocks[match[1]]) {
        subBlockKey = match[1];
      }
    } else if (rota.startsWith('/admin')) {
      blockKey = 'admin';
    } else if (rota.startsWith('/relatorios')) {
      blockKey = 'relatorios';
    } else if (rota.startsWith('/acoes-sociais') || rota.startsWith('/formulario-acoes')) {
      blockKey = 'acoes-sociais';
    } else if (rota.startsWith('/listas-presenca')) {
      blockKey = 'listas-presenca';
    } else if (rota.startsWith('/agenda')) {
      blockKey = 'agenda';
    }

    // Inicializar grupo se não existir
    if (!groups[blockKey]) {
      const def = blockDefinitions[blockKey] || blockDefinitions['geral'];
      groups[blockKey] = {
        key: blockKey,
        label: def.label,
        icon: def.icon,
        screens: [],
        subGroups: blockKey === 'gestao-adm' ? [] : undefined,
      };
    }

    // Se tem sub-bloco, adicionar ao sub-grupo
    if (subBlockKey && groups[blockKey].subGroups) {
      let subGroup = groups[blockKey].subGroups!.find(sg => sg.key === subBlockKey);
      if (!subGroup) {
        subGroup = {
          key: subBlockKey,
          label: gestaoAdmSubBlocks[subBlockKey],
          screens: [],
        };
        groups[blockKey].subGroups!.push(subGroup);
      }
      subGroup.screens.push(screen);
    } else {
      groups[blockKey].screens.push(screen);
    }
  });

  // Ordenar sub-grupos e telas dentro deles
  Object.values(groups).forEach(group => {
    group.screens.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (group.subGroups) {
      group.subGroups.sort((a, b) => a.label.localeCompare(b.label));
      group.subGroups.forEach(sg => {
        sg.screens.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      });
    }
  });

  // Ordenar grupos por order definido
  return Object.values(groups).sort((a, b) => {
    const orderA = blockDefinitions[a.key]?.order || 99;
    const orderB = blockDefinitions[b.key]?.order || 99;
    return orderA - orderB;
  });
}

// Componente para renderizar os checkboxes de permissão de uma tela
function ScreenPermissionRow({
  screen,
  hasPermission,
  togglePermission,
  isOperationLoading,
  indent = false,
}: {
  screen: SystemScreen;
  hasPermission: (screenId: string, role: string) => boolean;
  togglePermission: (screenId: string, role: string) => void;
  isOperationLoading: (screenId: string, role: string) => boolean;
  indent?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 bg-card ${indent ? 'ml-4' : ''}`}>
      <div className="mb-3">
        <div className="font-medium text-sm">{screen.nome}</div>
        <div className="text-xs text-muted-foreground">{screen.rota}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ROLES.map(role => (
          <div key={role.value} className="flex items-center gap-2 p-2 rounded border bg-background">
            {isOperationLoading(screen.id, role.value) ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Checkbox
                id={`${screen.id}-${role.value}`}
                checked={hasPermission(screen.id, role.value)}
                onCheckedChange={() => togglePermission(screen.id, role.value)}
                disabled={isOperationLoading(screen.id, role.value)}
              />
            )}
            <label 
              htmlFor={`${screen.id}-${role.value}`}
              className="text-xs cursor-pointer truncate"
              title={role.label}
            >
              {role.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente para um sub-grupo (ex: Estágio dentro de Gestão ADM)
function SubGroupAccordion({
  subGroup,
  hasPermission,
  togglePermission,
  isOperationLoading,
}: {
  subGroup: { key: string; label: string; screens: SystemScreen[] };
  hasPermission: (screenId: string, role: string) => boolean;
  togglePermission: (screenId: string, role: string) => void;
  isOperationLoading: (screenId: string, role: string) => boolean;
}) {
  const getSubGroupIcon = (key: string) => {
    switch (key) {
      case 'estagio': return <GraduationCap className="h-4 w-4" />;
      case 'treinamento': return <Users className="h-4 w-4" />;
      case 'integrantes': return <UserCog className="h-4 w-4" />;
      case 'inadimplencia': return <FileText className="h-4 w-4" />;
      default: return <ChevronRight className="h-4 w-4" />;
    }
  };

  return (
    <AccordionItem value={`sub-${subGroup.key}`} className="border rounded-lg px-3 bg-muted/30">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-2">
          {getSubGroupIcon(subGroup.key)}
          <span className="font-medium">{subGroup.label}</span>
          <Badge variant="secondary" className="ml-2">
            {subGroup.screens.length}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <div className="space-y-2">
          {subGroup.screens.map(screen => (
            <ScreenPermissionRow
              key={screen.id}
              screen={screen}
              hasPermission={hasPermission}
              togglePermission={togglePermission}
              isOperationLoading={isOperationLoading}
              indent
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function AdminPermissoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  const { screens, loading, togglePermission, hasPermission, isOperationLoading, refetch, hasUnsyncedChanges } = useScreenPermissions();
  const [refreshing, setRefreshing] = useState(false);

  // Agrupar telas por bloco
  const groupedScreens = useMemo(() => groupScreensByBlock(screens), [screens]);

  // Contar total de telas em um grupo (incluindo sub-grupos)
  const getTotalScreenCount = (group: ScreenGroup) => {
    let count = group.screens.length;
    if (group.subGroups) {
      count += group.subGroups.reduce((acc, sg) => acc + sg.screens.length, 0);
    }
    return count;
  };

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loadingAccess || loading) {
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

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Gerenciamento de Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Controle quais perfis têm acesso a cada tela do sistema
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {hasUnsyncedChanges && (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              Há alterações pendentes. Clique em "Sincronizar" para atualizar.
            </span>
          </div>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Matriz de Permissões
          </CardTitle>
          <CardDescription>
            Marque as caixas para conceder acesso. Desmarque para remover. Telas organizadas por área.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-2">
            {groupedScreens.map(group => (
              <AccordionItem 
                key={group.key} 
                value={group.key}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {group.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{group.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {getTotalScreenCount(group)} {getTotalScreenCount(group) === 1 ? 'tela' : 'telas'}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {/* Telas diretas do grupo (sem sub-grupo) */}
                    {group.screens.map(screen => (
                      <ScreenPermissionRow
                        key={screen.id}
                        screen={screen}
                        hasPermission={hasPermission}
                        togglePermission={togglePermission}
                        isOperationLoading={isOperationLoading}
                      />
                    ))}

                    {/* Sub-grupos (ex: Estágio, Treinamento, Integrantes) */}
                    {group.subGroups && group.subGroups.length > 0 && (
                      <Accordion type="multiple" className="w-full space-y-2">
                        {group.subGroups.map(subGroup => (
                          <SubGroupAccordion
                            key={subGroup.key}
                            subGroup={subGroup}
                            hasPermission={hasPermission}
                            togglePermission={togglePermission}
                            isOperationLoading={isOperationLoading}
                          />
                        ))}
                      </Accordion>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legenda de Perfis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map(role => (
              <div key={role.value} className="flex items-center gap-2">
                <Badge className={`${role.color} text-white`}>
                  {role.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {role.value === 'admin' && 'Acesso total ao sistema'}
                  {role.value === 'moderator' && 'Gerencia integrantes e eventos'}
                  {role.value === 'comando' && 'Integrante de comando (Grau I-IV)'}
                  {role.value === 'diretor_regional' && 'Gerencia regional e visualiza relatórios'}
                  {role.value === 'adm_regional' && 'Acesso administrativo total à regional'}
                  {role.value === 'regional' && 'Gerencia regional (role legada)'}
                  {role.value === 'diretor_divisao' && 'Gerencia divisão e visualiza relatórios'}
                  {role.value === 'social_divisao' && 'Gerencia ações sociais da divisão'}
                  {role.value === 'adm_divisao' && 'Gerencia administrativo da divisão'}
                  {role.value === 'user' && 'Acesso básico'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
