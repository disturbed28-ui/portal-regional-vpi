import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Sync Firebase user with Lovable Cloud profiles table
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', firebaseUser.uid)
          .maybeSingle();

        if (!existingProfile) {
          // Create profile for new user
          await supabase.from('profiles').insert({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Visitante',
            photo_url: firebaseUser.photoURL || '',
            status: 'Online'
          });

          // Assign default 'user' role
          await supabase.from('user_roles').insert({
            user_id: firebaseUser.uid,
            role: 'user'
          });
        } else {
          // Update existing profile status and info
          await supabase.from('profiles').update({
            name: firebaseUser.displayName || existingProfile.name,
            photo_url: firebaseUser.photoURL || existingProfile.photo_url,
            status: 'Online'
          }).eq('id', firebaseUser.uid);
        }

        toast({
          title: "Conectado com sucesso!",
          description: "Bem-vindo ao Portal Regional",
        });
      } else {
        toast({
          title: "Desconectado",
          description: "Até logo!",
        });
      }
    });

    return () => unsubscribe();
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
