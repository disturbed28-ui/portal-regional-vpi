import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao' | 'adm_regional' | 'comando';

interface UserRole {
  role: AppRole;
}

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useUserRole] Hook iniciado com userId:', userId);

    if (!userId) {
      console.log('[useUserRole] userId ausente, limpando roles');
      setRoles([]);
      setResolvedUserId(null);
      setLoading(false);
      return;
    }

    setRoles([]);
    setLoading(true);

    const fetchRoles = async () => {
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

      setResolvedUserId(userId);
      setLoading(false);
    };

    fetchRoles();

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

  const effectiveLoading = !!userId && (loading || resolvedUserId !== userId);

  return { roles, loading: effectiveLoading, hasRole };
};
