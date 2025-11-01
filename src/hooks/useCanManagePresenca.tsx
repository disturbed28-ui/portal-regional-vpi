import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCanManagePresenca = () => {
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setCanManage(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('integrantes_portal')
        .select('cargo_nome, grau')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar permissões:', error);
        setCanManage(false);
      } else if (data) {
        const isDiretor = data.cargo_nome === 'Diretor de Divisao' || 
                         data.cargo_nome === 'Sub Diretor de Divisao';
        const isGrauV = data.grau === 'V';
        setCanManage(isDiretor || isGrauV);
      } else {
        setCanManage(false);
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setCanManage(false);
    }

    setLoading(false);
  };

  return { canManage, loading };
};
