import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export type AccessLevel = 'full' | 'readonly' | 'none';

interface ScreenPermission {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  isReadOnly: boolean;
  hasAnyAccess: boolean;
}

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao' | 'adm_regional' | 'comando';

interface UseScreenPermissionsBatchResult {
  permissions: Record<string, ScreenPermission>;
  loading: boolean;
}

/**
 * Hook otimizado para buscar permissões de múltiplas telas em lote.
 * Reduz de N*2 queries para apenas 2 queries totais.
 * 
 * Regras especiais de acesso automático:
 * - Role 'adm_regional': Acesso full a todas as rotas /gestao-adm*
 * - Role 'comando': Acesso full a tudo (como admin)
 * 
 * @param routes - Array de rotas para verificar permissões
 * @param parentRoute - Rota pai para determinar acesso readonly
 * @param userId - ID do usuário
 */
export function useScreenPermissionsBatch(
  routes: string[],
  parentRoute: string,
  userId: string | undefined
): UseScreenPermissionsBatchResult {
  const [permissions, setPermissions] = useState<Record<string, ScreenPermission>>({});
  const [loading, setLoading] = useState(true);
  const { roles, loading: roleLoading } = useUserRole(userId);
  
  const routesKey = routes.join(',');
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    if (!userId) {
      prevKeyRef.current = '';
      setPermissions({});
      setLoading(false);
      return;
    }

    if (roleLoading) {
      setLoading(true);
      return;
    }

    const currentKey = `${userId}-${routesKey}-${roles.join(',')}`;
    if (currentKey === prevKeyRef.current) {
      return;
    }
    prevKeyRef.current = currentKey;

    const fetchPermissions = async () => {
      setLoading(true);
      
      try {
        const isAdmRegional = roles.includes('adm_regional');
        const isComando = roles.includes('comando');
        const isAdmin = roles.includes('admin');
        
        if (isComando || isAdmin) {
          const allFull = routes.reduce((acc, route) => ({
            ...acc,
            [route]: {
              hasAccess: true,
              accessLevel: 'full' as AccessLevel,
              isReadOnly: false,
              hasAnyAccess: true
            }
          }), {} as Record<string, ScreenPermission>);
          setPermissions(allFull);
          setLoading(false);
          return;
        }

        const allRoutes = routes.includes(parentRoute)
          ? routes
          : [parentRoute, ...routes];

        const { data: screens, error: screensError } = await supabase
          .from('system_screens')
          .select('id, rota')
          .in('rota', allRoutes)
          .eq('ativo', true);

        if (screensError) {
          console.error('[useScreenPermissionsBatch] Erro ao buscar telas:', screensError);
          throw screensError;
        }

        if (!screens?.length) {
          const allAllowed = routes.reduce((acc, route) => ({
            ...acc,
            [route]: {
              hasAccess: true,
              accessLevel: 'full' as AccessLevel,
              isReadOnly: false,
              hasAnyAccess: true
            }
          }), {} as Record<string, ScreenPermission>);
          setPermissions(allAllowed);
          setLoading(false);
          return;
        }

        const screenIds = screens.map(s => s.id);
        const { data: allPerms, error: permsError } = await supabase
          .from('screen_permissions')
          .select('screen_id, role')
          .in('screen_id', screenIds);

        if (permsError) {
          console.error('[useScreenPermissionsBatch] Erro ao buscar permissões:', permsError);
          throw permsError;
        }

        const screenIdToRoute = new Map(screens.map(s => [s.id, s.rota]));
        const routeToScreenId = new Map(screens.map(s => [s.rota, s.id]));

        const permsByRoute = new Map<string, AppRole[]>();
        allPerms?.forEach(p => {
          const route = screenIdToRoute.get(p.screen_id);
          if (route) {
            const existing = permsByRoute.get(route) || [];
            permsByRoute.set(route, [...existing, p.role as AppRole]);
          }
        });

        const parentPerms = permsByRoute.get(parentRoute) || [];
        const hasParentAccess = roles.some(r => parentPerms.includes(r as AppRole));

        const result: Record<string, ScreenPermission> = {};

        routes.forEach(route => {
          const routePerms = permsByRoute.get(route) || [];
          const screenExists = routeToScreenId.has(route);

          let accessLevel: AccessLevel = 'none';

          if (isAdmRegional && route.startsWith('/gestao-adm')) {
            accessLevel = 'full';
          } else if (!screenExists) {
            accessLevel = 'full';
          } else if (roles.some(r => routePerms.includes(r as AppRole))) {
            accessLevel = 'full';
          } else if (hasParentAccess) {
            accessLevel = 'readonly';
          }

          result[route] = {
            hasAccess: accessLevel === 'full',
            accessLevel,
            isReadOnly: accessLevel === 'readonly',
            hasAnyAccess: accessLevel !== 'none'
          };
        });

        setPermissions(result);
      } catch (error) {
        console.error('[useScreenPermissionsBatch] Error:', error);
        const denied = routes.reduce((acc, route) => ({
          ...acc,
          [route]: {
            hasAccess: false,
            accessLevel: 'none' as AccessLevel,
            isReadOnly: false,
            hasAnyAccess: false
          }
        }), {} as Record<string, ScreenPermission>);
        setPermissions(denied);
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [userId, routesKey, roles, roleLoading, parentRoute]);

  const effectiveLoading = !!userId && (loading || roleLoading);

  return { permissions, loading: effectiveLoading };
}

/**
 * Helper para criar objeto de permissão padrão (sem acesso)
 */
export function getDefaultPermission(): ScreenPermission {
  return {
    hasAccess: false,
    accessLevel: 'none',
    isReadOnly: false,
    hasAnyAccess: false
  };
}
