import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao' | 'adm_regional' | 'comando';

interface UserRole {
  role: AppRole;
}

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    console.log('[useUserRole] Hook iniciado com userId:', userId, 'authLoading:', authLoading);

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!userId) {
      console.log('[useUserRole] userId ausente após auth resolvida, limpando roles');
      setRoles([]);
      setResolvedUserId(null);
      setLoading(false);
      return;
    }

    if (resolvedUserId !== userId) {
      setRoles([]);
      setLoading(true);
    }

    const fetchRoles = async (isRefetch = false) => {
      console.log('[useUserRole] Buscando roles para userId:', userId, 'isRefetch:', isRefetch);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('[useUserRole] ERRO ao buscar roles:', error);
        if (!isRefetch) setRoles([]);
      } else {
        const mappedRoles = (data as UserRole[]).map(r => r.role);
        console.log('[useUserRole] Roles mapeadas:', mappedRoles);
        setRoles(prev => {
          if (prev.length === mappedRoles.length && prev.every(r => mappedRoles.includes(r))) {
            return prev;
          }
          return mappedRoles;
        });
      }

      setResolvedUserId(userId);
      setLoading(false);
    };

    fetchRoles(false);

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
          fetchRoles(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, authLoading]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const effectiveLoading = authLoading || (!!userId && (loading || resolvedUserId !== userId));

  return { roles, loading: effectiveLoading, hasRole };
};
