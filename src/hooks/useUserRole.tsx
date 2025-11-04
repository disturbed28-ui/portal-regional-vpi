import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional';

interface UserRole {
  role: AppRole;
}

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useUserRole] Hook iniciado com userId:', userId);
    
    if (!userId) {
      console.log('[useUserRole] userId e undefined/null, aguardando...');
      setRoles([]);
      // NÃO setar loading como false - continuar aguardando até receber userId válido
      return;
    }

    const fetchRoles = async () => {
      setLoading(true); // Garantir que loading esta true durante fetch
      console.log('[useUserRole] Buscando roles para userId:', userId);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('[useUserRole] ERRO ao buscar roles:', error);
        setRoles([]);
      } else {
        console.log('[useUserRole] Roles encontradas:', data);
        const mappedRoles = (data as UserRole[]).map(r => r.role);
        console.log('[useUserRole] Roles mapeadas:', mappedRoles);
        setRoles(mappedRoles);
      }
      setLoading(false);
    };

    fetchRoles();

    // Subscribe to role changes
    const channel = supabase
      .channel(`user-roles-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchRoles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  return { roles, loading, hasRole };
};
