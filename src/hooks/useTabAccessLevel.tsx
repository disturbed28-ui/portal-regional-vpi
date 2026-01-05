import { useMemo } from 'react';
import { useScreenAccess } from '@/hooks/useScreenAccess';

export type AccessLevel = 'full' | 'readonly' | 'none';

interface TabAccessLevelResult {
  accessLevel: AccessLevel;
  isReadOnly: boolean;
  hasAnyAccess: boolean;
  loading: boolean;
}

/**
 * Hook para determinar o nível de acesso a uma aba/sub-aba
 * 
 * - 'full': Permissão explícita na aba → pode ver E editar
 * - 'readonly': Só tem permissão na raiz → pode VER, mas NÃO pode editar
 * - 'none': Sem acesso → aba não aparece
 */
export function useTabAccessLevel(
  tabRoute: string, 
  userId: string | undefined,
  parentRoute: string = '/gestao-adm'
): TabAccessLevelResult {
  const { hasAccess: hasTabAccess, loading: loadingTab } = useScreenAccess(tabRoute, userId);
  const { hasAccess: hasParentAccess, loading: loadingParent } = useScreenAccess(parentRoute, userId);
  
  const accessLevel: AccessLevel = useMemo(() => {
    if (hasTabAccess) return 'full';           // Permissão explícita → acesso total
    if (hasParentAccess) return 'readonly';    // Só tem acesso à raiz → somente leitura
    return 'none';                              // Sem acesso
  }, [hasTabAccess, hasParentAccess]);
  
  return { 
    accessLevel, 
    isReadOnly: accessLevel === 'readonly',
    hasAnyAccess: accessLevel !== 'none',
    loading: loadingTab || loadingParent 
  };
}
