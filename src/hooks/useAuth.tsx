import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
          // Chamar edge function de migração para vincular perfis antigos
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
                console.error('[useAuth] Error migrating user:', error);
              } else {
                console.log('[useAuth] Migration result:', data);
                
                // Mostrar toast apropriado
                const hasShownWelcomeToast = sessionStorage.getItem('welcome_toast_shown');
                
                if (!hasShownWelcomeToast) {
                  if (data?.migrated) {
                    toast({
                      title: "Bem-vindo de volta!",
                      description: "Seu perfil foi migrado com sucesso.",
                    });
                  } else if (data?.new_user) {
                    toast({
                      title: "Conectado com sucesso!",
                      description: "Bem-vindo ao Portal Regional",
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
              console.error('[useAuth] Failed to migrate user:', error);
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
      if (error) throw error;
    } catch (error: any) {
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
