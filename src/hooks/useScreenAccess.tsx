import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

export const useScreenAccess = (screenRoute: string, userId: string | undefined) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { roles, loading: roleLoading } = useUserRole(userId);

  useEffect(() => {
    checkAccess();
  }, [screenRoute, roles, userId, roleLoading]);

  const checkAccess = async () => {
    // SEMPRE aguardar userId estar definido
    if (!userId) {
      console.log("[useScreenAccess] ===== AGUARDANDO userId =====", {
        screenRoute,
        userId: 'undefined'
      });
      setHasAccess(false);
      setLoading(true);
      return;
    }

    // SEMPRE aguardar roleLoading terminar
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

    // AGORA SIM verificar se usuário não tem roles após loading completo
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

      if (screenError) {
        // Erro ao buscar tela - registrar log
        console.error("[useScreenAccess] Erro ao buscar tela:", screenError);
        logSystemEventFromClient({
          tipo: 'DATABASE_ERROR',
          origem: 'frontend:useScreenAccess',
          rota: screenRoute,
          mensagem: 'Erro ao buscar configuração da tela',
          detalhes: { screenRoute, error: screenError.message }
        });
        setHasAccess(false);
        setLoading(false);
        return;
      }
      
      if (!screen) {
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
        logSystemEventFromClient({
          tipo: 'FUNCTION_ERROR',
          origem: 'frontend:useScreenAccess',
          rota: screenRoute,
          mensagem: 'Erro ao verificar permissões da tela',
          detalhes: { screenRoute, screenId: screen.id, error: permError.message }
        });
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
        
        // Se não tem acesso, registrar log de permissão negada
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
      }
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
    }

    setLoading(false);
  };

  return { hasAccess, loading };
};
