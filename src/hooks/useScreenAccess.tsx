import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export const useScreenAccess = (screenRoute: string, userId: string | undefined) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { roles, loading: rolesLoading } = useUserRole(userId);

  useEffect(() => {
    checkAccess();
  }, [screenRoute, roles, userId, rolesLoading]);

  const checkAccess = async () => {
    // Se userId é undefined ou roles ainda está carregando, aguardar
    if (userId === undefined || rolesLoading) {
      setLoading(true);
      return;
    }

    // Se userId é null (não logado) OU não tem roles, bloquear
    if (userId === null || roles.length === 0) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      // Buscar a tela
      const { data: screen, error: screenError } = await supabase
        .from('system_screens')
        .select('id')
        .eq('rota', screenRoute)
        .eq('ativo', true)
        .maybeSingle();

      if (screenError || !screen) {
        // Se a tela não está cadastrada, permitir acesso (backward compatibility)
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Verificar se alguma das roles do usuário tem permissão
      const { data: permissions, error: permError } = await supabase
        .from('screen_permissions')
        .select('role')
        .eq('screen_id', screen.id);

      if (permError) {
        console.error('Erro ao verificar permissões:', permError);
        setHasAccess(false);
      } else {
        const allowedRoles = permissions?.map(p => p.role) || [];
        const userHasAccess = roles.some(role => allowedRoles.includes(role));
        setHasAccess(userHasAccess);
      }
    } catch (error) {
      console.error('Erro ao verificar acesso:', error);
      setHasAccess(false);
    }

    setLoading(false);
  };

  return { hasAccess, loading };
};
