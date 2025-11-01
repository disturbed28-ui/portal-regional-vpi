import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

export const useCanManagePresenca = () => {
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      setLoading(true);
      
      // Pegar Firebase UID
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.log('[useCanManagePresenca] Usuário não autenticado no Firebase');
        setCanManage(false);
        setLoading(false);
        return;
      }

      const firebase_uid = firebaseUser.uid;
      console.log('[useCanManagePresenca] Firebase UID:', firebase_uid);

      // Buscar user_id no profiles usando firebase_uid
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', firebase_uid)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('[useCanManagePresenca] Erro ao buscar profile:', profileError);
        setCanManage(false);
        setLoading(false);
        return;
      }

      const user_id = profile.id;
      console.log('[useCanManagePresenca] user_id encontrado:', user_id);

      // Buscar roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id);

      if (rolesError) {
        console.error('[useCanManagePresenca] Erro ao buscar roles:', rolesError);
        setCanManage(false);
        setLoading(false);
        return;
      }

      const roles = userRoles?.map(r => r.role) || [];
      console.log('[useCanManagePresenca] Roles encontradas:', roles);

      const hasPermission = roles.includes('admin') || roles.includes('moderator');
      setCanManage(hasPermission);
      setLoading(false);
    };

    checkPermissions();

    // Listener para mudanças no auth do Firebase
    const unsubscribe = auth.onAuthStateChanged(() => {
      checkPermissions();
    });

    return () => unsubscribe();
  }, []);

  return { canManage, loading };
};
