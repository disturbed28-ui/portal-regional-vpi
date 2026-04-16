import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const logLoginAccess = async (userId: string, rota: string) => {
  try {
    await supabase
      .from("profiles")
      .update({ last_access_at: new Date().toISOString() })
      .eq("id", userId);

    await supabase.from("user_access_logs").insert({
      user_id: userId,
      tipo_evento: "login",
      rota: rota || "/",
      origem: "frontend",
      user_agent: navigator.userAgent,
    });

    console.log("[useAuth] Login access logged for user:", userId);
  } catch (error) {
    console.error("[useAuth] Error logging login access:", error);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state changed:', event);

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            try {
              const { data, error } = await supabase.functions.invoke('migrate-user-on-login', {
                body: {
                  user_id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name,
                  avatar_url: session.user.user_metadata?.avatar_url,
                }
              });

              if (error) {
                console.error('[useAuth] Error creating profile:', error);
                logSystemEventFromClient({
                  tipo: 'FUNCTION_ERROR',
                  origem: 'frontend:useAuth',
                  rota: window.location.pathname,
                  mensagem: 'Erro ao criar/atualizar perfil no login',
                  detalhes: {
                    userId: session.user.id,
                    email: session.user.email,
                    error: error.message
                  }
                });
              } else {
                console.log('[useAuth] Profile creation result:', data);
                logLoginAccess(session.user.id, window.location.pathname);

                const hasShownWelcomeToast = sessionStorage.getItem('welcome_toast_shown');

                if (!hasShownWelcomeToast) {
                  if (data?.new_user) {
                    toast({
                      title: "Bem-vindo!",
                      description: "Seu perfil foi criado com sucesso.",
                    });
                  } else {
                    toast({
                      title: "Conectado com sucesso!",
                      description: "Bem-vindo de volta!",
                    });
                  }
                  sessionStorage.setItem('welcome_toast_shown', 'true');
                }
              }
            } catch (error: any) {
              console.error('[useAuth] Failed to create profile:', error);
              logSystemEventFromClient({
                tipo: 'FUNCTION_ERROR',
                origem: 'frontend:useAuth',
                rota: window.location.pathname,
                mensagem: 'Exceção ao criar/atualizar perfil no login',
                detalhes: {
                  userId: session.user.id,
                  email: session.user.email,
                  error: error.message
                }
              });
            }
          }, 500);
        } else if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('welcome_toast_shown');
          toast({
            title: "Desconectado",
            description: "Até logo!",
          });
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('[useAuth] Error signing in with Google:', error);
      logSystemEventFromClient({
        tipo: 'AUTH_ERROR',
        origem: 'frontend:useAuth',
        rota: window.location.pathname,
        mensagem: 'Erro ao fazer login com Google',
        detalhes: { error: error.message }
      });
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        await supabase.from('profiles').update({
          status: 'Offline'
        }).eq('id', user.id);
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        if (error.message?.includes('session') || error.status === 403) {
          console.warn('[useAuth] Sessão não encontrada no servidor, limpando estado local');
          setSession(null);
          setUser(null);
          sessionStorage.removeItem('welcome_toast_shown');

          toast({
            title: "Desconectado",
            description: "Você foi desconectado com sucesso.",
          });
          return;
        }

        throw error;
      }
    } catch (error: any) {
      console.error('[useAuth] Error signing out:', error);
      logSystemEventFromClient({
        tipo: 'AUTH_ERROR',
        origem: 'frontend:useAuth',
        rota: window.location.pathname,
        mensagem: 'Erro ao fazer logout',
        detalhes: {
          userId: user?.id,
          error: error.message
        }
      });
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
