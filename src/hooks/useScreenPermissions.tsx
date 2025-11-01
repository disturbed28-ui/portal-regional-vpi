import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_regional';

interface SystemScreen {
  id: string;
  nome: string;
  descricao: string | null;
  rota: string;
  icone: string | null;
  ordem: number;
  ativo: boolean;
}

interface ScreenPermission {
  id: string;
  screen_id: string;
  role: AppRole;
}

export const useScreenPermissions = () => {
  const [screens, setScreens] = useState<SystemScreen[]>([]);
  const [permissions, setPermissions] = useState<ScreenPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Buscar telas
    const { data: screensData, error: screensError } = await supabase
      .from('system_screens')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (screensError) {
      console.error('Erro ao buscar telas:', screensError);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as telas",
        variant: "destructive",
      });
    } else {
      setScreens(screensData || []);
    }

    // Buscar permissões
    const { data: permissionsData, error: permissionsError } = await supabase
      .from('screen_permissions')
      .select('*');

    if (permissionsError) {
      console.error('Erro ao buscar permissões:', permissionsError);
    } else {
      setPermissions(permissionsData || []);
    }

    setLoading(false);
  };

  const togglePermission = async (screenId: string, role: AppRole) => {
    const existing = permissions.find(
      p => p.screen_id === screenId && p.role === role
    );

    if (existing) {
      // Remover permissão
      const { error } = await supabase
        .from('screen_permissions')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('Erro ao remover permissão:', error);
        toast({
          title: "Erro",
          description: "Não foi possível remover a permissão",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Permissão removida",
        });
        fetchData();
      }
    } else {
      // Adicionar permissão
      const { error } = await supabase
        .from('screen_permissions')
        .insert({ screen_id: screenId, role });

      if (error) {
        console.error('Erro ao adicionar permissão:', error);
        toast({
          title: "Erro",
          description: "Não foi possível adicionar a permissão",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Permissão adicionada",
        });
        fetchData();
      }
    }
  };

  const hasPermission = (screenId: string, role: AppRole): boolean => {
    return permissions.some(p => p.screen_id === screenId && p.role === role);
  };

  return {
    screens,
    permissions,
    loading,
    togglePermission,
    hasPermission,
    refetch: fetchData,
  };
};
