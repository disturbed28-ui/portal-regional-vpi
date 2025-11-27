import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook customizado para verificar acesso ao bloco Admin.
 * Todas as páginas admin usam a mesma permissão: /admin
 */
export const useAdminAccess = () => {
  const { user } = useAuth();
  return useScreenAccess("/admin", user?.id);
};
