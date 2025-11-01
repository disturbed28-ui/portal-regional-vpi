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
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
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
    const operationKey = `${screenId}-${role}`;
    console.log('[useScreenPermissions] Iniciando togglePermission:', { screenId, role, operationKey });
    
    setOperationLoading(operationKey);

    const existing = permissions.find(
      p => p.screen_id === screenId && p.role === role
    );

    const screen = screens.find(s => s.id === screenId);
    const screenName = screen?.nome || 'Tela';

    console.log('[useScreenPermissions] Estado atual:', { 
      existing: !!existing, 
      permissionId: existing?.id,
      screenName 
    });

    if (existing) {
      // Atualização otimista - remove da UI primeiro
      console.log('[useScreenPermissions] Removendo permissão (otimista)...');
      setPermissions(prev => prev.filter(p => p.id !== existing.id));

      // Remover permissão
      const { error } = await supabase
        .from('screen_permissions')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('[useScreenPermissions] ERRO ao remover permissão:', error);
        // Reverter atualização otimista
        setPermissions(prev => [...prev, existing]);
        toast({
          title: "Erro ao remover",
          description: `${screenName} - ${role}: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('[useScreenPermissions] Permissão removida com sucesso');
        toast({
          title: "Permissão removida",
          description: `${screenName} - ${role}`,
        });
        fetchData();
      }
    } else {
      // Atualização otimista - adiciona na UI primeiro
      const newPermission: ScreenPermission = {
        id: `temp-${Date.now()}`,
        screen_id: screenId,
        role: role,
      };
      console.log('[useScreenPermissions] Adicionando permissão (otimista)...', newPermission);
      setPermissions(prev => [...prev, newPermission]);

      // Adicionar permissão
      const { data, error } = await supabase
        .from('screen_permissions')
        .insert({ screen_id: screenId, role })
        .select()
        .single();

      if (error) {
        console.error('[useScreenPermissions] ERRO ao adicionar permissão:', error);
        // Reverter atualização otimista
        setPermissions(prev => prev.filter(p => p.id !== newPermission.id));
        toast({
          title: "Erro ao adicionar",
          description: `${screenName} - ${role}: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('[useScreenPermissions] Permissão adicionada com sucesso:', data);
        toast({
          title: "Permissão adicionada",
          description: `${screenName} - ${role}`,
        });
        fetchData();
      }
    }

    setOperationLoading(null);
    console.log('[useScreenPermissions] togglePermission finalizado');
  };

  const hasPermission = (screenId: string, role: AppRole): boolean => {
    return permissions.some(p => p.screen_id === screenId && p.role === role);
  };

  const isOperationLoading = (screenId: string, role: AppRole): boolean => {
    return operationLoading === `${screenId}-${role}`;
  };

  return {
    screens,
    permissions,
    loading,
    operationLoading,
    togglePermission,
    hasPermission,
    isOperationLoading,
    refetch: fetchData,
  };
};
