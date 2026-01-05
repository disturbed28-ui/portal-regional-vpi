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

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao';

interface UseScreenPermissionsBatchResult {
  permissions: Record<string, ScreenPermission>;
  loading: boolean;
}

/**
 * Hook otimizado para buscar permissões de múltiplas telas em lote.
 * Reduz de N*2 queries para apenas 2 queries totais.
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
  
  // Usar ref para evitar re-fetches desnecessários
  const routesKey = routes.join(',');
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    // Se userId não existe ou roles ainda carregando, aguardar
    if (!userId) {
      setLoading(true);
      return;
    }

    if (roleLoading) {
      setLoading(true);
      return;
    }

    // Evitar re-fetch se as rotas não mudaram
    const currentKey = `${userId}-${routesKey}-${roles.join(',')}`;
    if (currentKey === prevKeyRef.current) {
      return;
    }
    prevKeyRef.current = currentKey;

    const fetchPermissions = async () => {
      setLoading(true);
      
      try {
        // Incluir parentRoute na busca se não estiver nas routes
        const allRoutes = routes.includes(parentRoute) 
          ? routes 
          : [parentRoute, ...routes];

        // 1. Buscar todas as telas de uma vez
        const { data: screens, error: screensError } = await supabase
          .from('system_screens')
          .select('id, rota')
          .in('rota', allRoutes)
          .eq('ativo', true);

        if (screensError) {
          console.error('[useScreenPermissionsBatch] Erro ao buscar telas:', screensError);
          throw screensError;
        }

        // Se nenhuma tela cadastrada, permitir todas (backward compatibility)
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

        // 2. Buscar todas as permissões de uma vez
        const screenIds = screens.map(s => s.id);
        const { data: allPerms, error: permsError } = await supabase
          .from('screen_permissions')
          .select('screen_id, role')
          .in('screen_id', screenIds);

        if (permsError) {
          console.error('[useScreenPermissionsBatch] Erro ao buscar permissões:', permsError);
          throw permsError;
        }

        // 3. Mapear permissões por rota
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

        // 4. Verificar acesso do parent
        const parentPerms = permsByRoute.get(parentRoute) || [];
        const hasParentAccess = roles.some(r => parentPerms.includes(r as AppRole));

        // 5. Calcular acesso para cada rota
        const result: Record<string, ScreenPermission> = {};
        
        routes.forEach(route => {
          const routePerms = permsByRoute.get(route) || [];
          const screenExists = routeToScreenId.has(route);
          
          let accessLevel: AccessLevel = 'none';
          
          if (!screenExists) {
            // Tela não cadastrada = permitir (backward compatibility)
            accessLevel = 'full';
          } else if (roles.some(r => routePerms.includes(r as AppRole))) {
            // Tem permissão explícita na aba
            accessLevel = 'full';
          } else if (hasParentAccess) {
            // Só tem permissão no parent → readonly
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
        // Em caso de erro, negar acesso por segurança
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

  return { permissions, loading };
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
