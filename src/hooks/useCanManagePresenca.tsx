import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useCanManagePresenca = () => {
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkPermissions = async () => {
      setLoading(true);

      if (!user) {
        console.log('[useCanManagePresenca] Usuário não autenticado');
        setCanManage(false);
        setLoading(false);
        return;
      }

      const userId = user.id;
      console.log('[useCanManagePresenca] User ID:', userId);

      // Buscar roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('[useCanManagePresenca] Erro ao buscar roles:', rolesError);
        setCanManage(false);
        setLoading(false);
        return;
      }

      const roles = userRoles?.map(r => r.role) || [];
      console.log('[useCanManagePresenca] Roles encontradas:', roles);

      const hasPermission = roles.includes('admin') || roles.includes('moderator');
      setCanManage(hasPermission);
      setLoading(false);
    };

    checkPermissions();
  }, [user]);

  return { canManage, loading };
};
