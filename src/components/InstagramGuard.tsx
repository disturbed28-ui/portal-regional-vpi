import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { isInstagramPendente } from "@/lib/instagramUtils";

/**
 * Bloqueia a navegação enquanto o usuário não preencher o @ do Instagram no perfil.
 *
 * Usuários autenticados com `profiles.instagram` vazio são redirecionados para /perfil
 * (exceto em rotas públicas/auxiliares listadas em ALLOWED_PATHS).
 */
const ALLOWED_PATHS = new Set<string>([
  "/perfil",
  "/instalar",
  "/politica-privacidade",
  "/termos-servico",
]);

export const InstagramGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !profile) return;

    const pending = isInstagramPendente((profile as any).instagram);

    if (!pending) {
      toastShownRef.current = false;
      return;
    }

    // Não redirecionar em rotas permitidas
    if (ALLOWED_PATHS.has(location.pathname)) return;

    if (!toastShownRef.current) {
      toast.warning("Preencha seu @ do Instagram", {
        description: "Para continuar usando o sistema, informe seu @ do Instagram (ou N/A caso não possua).",
        duration: 6000,
      });
      toastShownRef.current = true;
    }

    navigate("/perfil", { replace: true });
  }, [user, profile, authLoading, profileLoading, location.pathname, navigate]);

  return <>{children}</>;
};
