import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { cadastroPerfilPendente } from "../../supabase/functions/_shared/cadastroPerfil";

/**
 * Encaminha cadastros incompletos para o formulário único.
 *
 * Usuários autenticados com dados essenciais pendentes são redirecionados para /perfil
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

    const pending = cadastroPerfilPendente(profile);

    if (!pending) {
      toastShownRef.current = false;
      return;
    }

    // Não redirecionar em rotas permitidas
    if (ALLOWED_PATHS.has(location.pathname)) return;

    const primeiroCadastro = !profile.nome_colete?.trim();
    if (!primeiroCadastro && !toastShownRef.current) {
      toast.warning("Complete seus dados", {
        description: "Informe seu telefone e, se desejar, seu Instagram. Você pode escolher não informar a rede social.",
        dismissible: false,
        duration: 6000,
      });
      toastShownRef.current = true;
    }

    navigate("/perfil", { replace: true });
  }, [user, profile, authLoading, profileLoading, location.pathname, navigate]);

  return <>{children}</>;
};
