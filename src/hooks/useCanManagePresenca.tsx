import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export const useCanManagePresenca = () => {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { roles, loading } = useUserRole(userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  const canManage = roles.includes('admin') || roles.includes('moderator');

  return { canManage, loading };
};
