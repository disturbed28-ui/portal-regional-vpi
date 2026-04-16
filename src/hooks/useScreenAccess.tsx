import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

export const useScreenAccess = (screenRoute: string, userId: string | undefined) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading } = useAuth();
  const { roles, loading: roleLoading } = useUserRole(userId);

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) {
        setLoading(true);
        return;
      }

      if (!userId) {
        console.log("[useScreenAccess] ===== SEM userId APÓS AUTH =====", {
          screenRoute,
          userId: 'undefined'
        });
        setHasAccess(false);
        setLoading(false);
        return;
      }

      if (roleLoading) {
        console.log("[useScreenAccess] ===== AGUARDANDO roleLoading =====", {
          screenRoute,
          userId,
          roleLoading: true,
          rolesAtual: roles
        });
        setLoading(true);
        return;
      }

      if (roles.length === 0) {
        console.log("[useScreenAccess] ===== SEM ACESSO =====", {
          screenRoute,
          userId,
          roles,
          roleLoading: false,
          motivo: 'sem roles após loading completo'
        });
        setHasAccess(false);
        setLoading(false);
        return;
      }

      console.log("[useScreenAccess] ===== INICIANDO VERIFICAÇÃO =====", {
        screenRoute,
        userId,
        roles,
        roleLoading: false
      });

      setLoading(true);

      try {
        const { data: screen, error: screenError } = await supabase
          .from('system_screens')
          .select('id')
          .eq('rota', screenRoute)
          .eq('ativo', true)
          .maybeSingle();

        if (screenError) {
          console.error("[useScreenAccess] Erro ao buscar tela:", screenError);
          logSystemEventFromClient({
            tipo: 'DATABASE_ERROR',
            origem: 'frontend:useScreenAccess',
            rota: screenRoute,
            mensagem: 'Erro ao buscar configuração da tela',
            detalhes: { screenRoute, error: screenError.message }
          });
          setHasAccess(false);
          return;
        }

        if (!screen) {
          setHasAccess(true);
          return;
        }

        const { data: permissions, error: permError } = await supabase
          .from('screen_permissions')
          .select('role')
          .eq('screen_id', screen.id);

        if (permError) {
          console.error('[useScreenAccess] Erro ao verificar permissões:', permError);
          logSystemEventFromClient({
            tipo: 'FUNCTION_ERROR',
            origem: 'frontend:useScreenAccess',
            rota: screenRoute,
            mensagem: 'Erro ao verificar permissões da tela',
            detalhes: { screenRoute, screenId: screen.id, error: permError.message }
          });
          setHasAccess(false);
          return;
        }

        const allowedRoles = permissions?.map(p => p.role) || [];
        const userHasAccess = roles.some(role => allowedRoles.includes(role));

        if (!userHasAccess) {
          logSystemEventFromClient({
            tipo: 'PERMISSION_DENIED',
            origem: 'frontend:useScreenAccess',
            rota: screenRoute,
            mensagem: 'Usuário sem permissão para acessar esta tela',
            detalhes: {
              screenRoute,
              screenId: screen.id,
              userId,
              userRoles: roles,
              allowedRoles
            }
          });
        }

        setHasAccess(userHasAccess);
      } catch (error) {
        console.error('[useScreenAccess] Erro ao verificar acesso:', error);
        logSystemEventFromClient({
          tipo: 'FUNCTION_ERROR',
          origem: 'frontend:useScreenAccess',
          rota: screenRoute,
          mensagem: 'Erro inesperado ao verificar acesso à tela',
          detalhes: {
            screenRoute,
            userId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [screenRoute, roles, userId, roleLoading, authLoading]);

  const effectiveLoading = authLoading || (!!userId && (loading || roleLoading));

  return { hasAccess, loading: effectiveLoading };
};
