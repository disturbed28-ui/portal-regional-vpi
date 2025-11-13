import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export const useScreenAccess = (screenRoute: string, userId: string | undefined) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { roles } = useUserRole(userId);

  useEffect(() => {
    checkAccess();
  }, [screenRoute, roles, userId]);

  const checkAccess = async () => {
    if (!userId || roles.length === 0) {
      console.log("[useScreenAccess] ===== SEM ACESSO =====", {
        screenRoute,
        userId,
        roles,
        motivo: !userId ? 'userId não definido' : 'sem roles'
      });
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      console.log("[useScreenAccess] ===== VERIFICANDO ACESSO =====", {
        screenRoute,
        userId,
        roles
      });

      // Buscar a tela
      const { data: screen, error: screenError } = await supabase
        .from('system_screens')
        .select('id')
        .eq('rota', screenRoute)
        .eq('ativo', true)
        .maybeSingle();

      console.log("[useScreenAccess] Tela encontrada?", { screen, screenError });

      if (screenError || !screen) {
        // Se a tela não está cadastrada, permitir acesso (backward compatibility)
        console.log("[useScreenAccess] ===== TELA NÃO CADASTRADA - PERMITINDO ACESSO =====", {
          screenRoute,
          motivo: 'backward compatibility'
        });
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Verificar se alguma das roles do usuário tem permissão
      const { data: permissions, error: permError } = await supabase
        .from('screen_permissions')
        .select('role')
        .eq('screen_id', screen.id);

      console.log("[useScreenAccess] Permissões da tela:", { permissions, permError });

      if (permError) {
        console.error('[useScreenAccess] Erro ao verificar permissões:', permError);
        setHasAccess(false);
      } else {
        const allowedRoles = permissions?.map(p => p.role) || [];
        const userHasAccess = roles.some(role => allowedRoles.includes(role));
        
        console.log("[useScreenAccess] ===== RESULTADO FINAL =====", {
          screenRoute,
          allowedRoles,
          userRoles: roles,
          userHasAccess,
          comparacao: roles.map(r => ({ role: r, allowed: allowedRoles.includes(r) }))
        });
        
        setHasAccess(userHasAccess);
      }
    } catch (error) {
      console.error('[useScreenAccess] Erro ao verificar acesso:', error);
      setHasAccess(false);
    }

    setLoading(false);
  };

  return { hasAccess, loading };
};
