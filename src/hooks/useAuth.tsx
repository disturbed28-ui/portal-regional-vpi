import { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from "firebase/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Clear previous timeout if exists
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        console.log('Debouncing sync call...');
      }

      if (firebaseUser) {
        // Wait 2s before syncing (debounce)
        syncTimeoutRef.current = setTimeout(async () => {
          try {
            console.log('Syncing user with Lovable Cloud:', firebaseUser.uid);
            
            const { data, error } = await supabase.functions.invoke('sync-firebase-user', {
              body: {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              }
            });

            if (error) {
              console.error('Error syncing user:', error);
              toast({
                title: "Erro ao sincronizar perfil",
                description: error.message,
                variant: "destructive",
              });
              return;
            }

            console.log('User synced successfully:', data);
            
            // Usar sessionStorage para controlar toast por sessão
            const hasShownWelcomeToast = sessionStorage.getItem('welcome_toast_shown');
            
            if (!hasShownWelcomeToast) {
              setTimeout(() => {
                toast({
                  title: "Conectado com sucesso!",
                  description: "Bem-vindo ao Portal Regional",
                });
              }, 500);
              sessionStorage.setItem('welcome_toast_shown', 'true');
            }
          } catch (error: any) {
            console.error('Failed to sync user:', error);
            toast({
              title: "Erro ao conectar",
              description: error.message,
              variant: "destructive",
            });
          }
        }, 500); // 500ms debounce - suficiente para evitar multiplas chamadas
      } else {
        // Limpar flag do sessionStorage no logout
        sessionStorage.removeItem('welcome_toast_shown');
        
        toast({
          title: "Desconectado",
          description: "Até logo!",
        });
      }
    });

    return () => {
      unsubscribe();
      // Clear timeout on unmount
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [toast]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
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
        }).eq('id', user.uid);
      }
      
      await firebaseSignOut(auth);
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
    loading,
    signInWithGoogle,
    signOut,
  };
};
