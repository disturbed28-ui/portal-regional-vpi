import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          // Chamar edge function para criar/atualizar perfil
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
                // Não mostrar toast - edge function já trata casos conhecidos
              } else {
                console.log('[useAuth] Profile creation result:', data);
                
                // Mostrar toast de boas-vindas
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
              // Não mostrar toast - edge function já trata casos conhecidos
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
      // Update status to offline before signing out
      if (user) {
        await supabase.from('profiles').update({
          status: 'Offline'
        }).eq('id', user.id);
      }
      
      const { error } = await supabase.auth.signOut();
      
      // Tratar erro 403 de forma especial (comum em iframes)
      if (error) {
        // Se for erro de sessão não encontrada, limpar estado local mesmo assim
        if (error.message?.includes('session') || error.status === 403) {
          console.warn('[useAuth] Sessão não encontrada no servidor, limpando estado local');
          
          // Forçar limpeza local
          setSession(null);
          setUser(null);
          sessionStorage.removeItem('welcome_toast_shown');
          
          toast({
            title: "Desconectado",
            description: "Você foi desconectado com sucesso.",
          });
          return; // Não lançar erro
        }
        
        // Para outros erros, lançar normalmente
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

  return {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };
};
