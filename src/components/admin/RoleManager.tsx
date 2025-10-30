import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, User, Users } from "lucide-react";

interface RoleManagerProps {
  profileId: string;
}

type AppRole = 'admin' | 'moderator' | 'user';

const ROLES_CONFIG: Record<AppRole, { label: string; icon: React.ReactNode; description: string }> = {
  admin: {
    label: "Administrador",
    icon: <Shield className="h-4 w-4" />,
    description: "Acesso total ao sistema"
  },
  moderator: {
    label: "Colaborador",
    icon: <Users className="h-4 w-4" />,
    description: "Acesso intermediário"
  },
  user: {
    label: "Usuário",
    icon: <User className="h-4 w-4" />,
    description: "Acesso básico"
  }
};

export function RoleManager({ profileId }: RoleManagerProps) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, [profileId]);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileId);

      if (error) throw error;

      setRoles((data || []).map(r => r.role as AppRole));
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar permissões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (role: AppRole, checked: boolean) => {
    setUpdating(true);
    try {
      // Usar a anon key - as políticas RLS agora permitem operações
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (checked) {
        // Adicionar role
        const response = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ user_id: profileId, role })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erro ao adicionar role');
        }
        
        setRoles([...roles, role]);
        toast({
          title: "Permissão adicionada",
          description: `${ROLES_CONFIG[role].label} atribuído com sucesso`,
        });
      } else {
        // Remover role
        const response = await fetch(
          `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${profileId}&role=eq.${role}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
            }
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erro ao remover role');
        }
        
        setRoles(roles.filter(r => r !== role));
        toast({
          title: "Permissão removida",
          description: `${ROLES_CONFIG[role].label} removido com sucesso`,
        });
      }
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao atualizar permissão",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando permissões...</div>;
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Permissões do Usuário</h3>
        <p className="text-xs text-muted-foreground">
          Gerencie as permissões de acesso ao sistema
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(ROLES_CONFIG) as AppRole[]).map((role) => {
          const config = ROLES_CONFIG[role];
          const hasRole = roles.includes(role);

          return (
            <div
              key={role}
              className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <Checkbox
                id={`role-${role}`}
                checked={hasRole}
                onCheckedChange={(checked) => toggleRole(role, checked as boolean)}
                disabled={updating}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor={`role-${role}`}
                  className="flex items-center gap-2 font-medium cursor-pointer"
                >
                  {config.icon}
                  {config.label}
                  {hasRole && (
                    <Badge variant="secondary" className="text-xs">
                      Ativo
                    </Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
