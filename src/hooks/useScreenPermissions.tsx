import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logSystemEventFromClient } from "@/lib/logSystemEvent";

type AppRole = 'admin' | 'moderator' | 'user' | 'diretor_divisao' | 'diretor_regional' | 'regional' | 'social_divisao' | 'adm_divisao' | 'app.authenticated' | 'presence.view_division' | 'presence.view_region';

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
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
      logSystemEventFromClient({
        tipo: 'DATABASE_ERROR',
        origem: 'frontend:useScreenPermissions',
        mensagem: 'Erro ao buscar telas do sistema',
        detalhes: { error: screensError.message }
      });
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
      logSystemEventFromClient({
        tipo: 'DATABASE_ERROR',
        origem: 'frontend:useScreenPermissions',
        mensagem: 'Erro ao buscar permissões de telas',
        detalhes: { error: permissionsError.message }
      });
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

    // Pegar user ID
    if (!user) {
      console.error('[useScreenPermissions] Usuário não autenticado');
      logSystemEventFromClient({
        tipo: 'AUTH_ERROR',
        origem: 'frontend:useScreenPermissions',
        mensagem: 'Tentativa de alterar permissões sem autenticação',
        detalhes: { screenId, role }
      });
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      setOperationLoading(null);
      return;
    }

    const user_id = user.id;
    console.log('[useScreenPermissions] User ID:', user_id);

    if (existing) {
      // Atualização otimista - remove da UI primeiro
      console.log('[useScreenPermissions] Removendo permissão (otimista)...');
      setPermissions(prev => prev.filter(p => p.id !== existing.id));

      // Remover permissão via Edge Function
      console.log('[useScreenPermissions] Chamando edge function para remover...');
      const { data, error } = await supabase.functions.invoke('manage-screen-permissions', {
        body: {
          action: 'remove',
          screen_id: screenId,
          role: role,
          user_id: user_id,
        }
      });

      if (error) {
        console.error('[useScreenPermissions] ERRO ao remover permissão:', error);
        logSystemEventFromClient({
          tipo: 'FUNCTION_ERROR',
          origem: 'frontend:useScreenPermissions',
          mensagem: 'Erro ao remover permissão de tela',
          detalhes: {
            screenId,
            screenName,
            role,
            error: error.message
          }
        });
        // Reverter atualização otimista
        setPermissions(prev => [...prev, existing]);
        toast({
          title: "Erro ao remover",
          description: `${screenName} - ${role}: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('[useScreenPermissions] Permissão removida com sucesso:', data);
        toast({
          title: "Permissão removida",
          description: `${screenName} - ${role}`,
        });
        setHasUnsyncedChanges(true);
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

      // Adicionar permissão via Edge Function
      console.log('[useScreenPermissions] Chamando edge function para adicionar...');
      const { data, error } = await supabase.functions.invoke('manage-screen-permissions', {
        body: {
          action: 'add',
          screen_id: screenId,
          role: role,
          user_id: user_id,
        }
      });

      if (error) {
        console.error('[useScreenPermissions] ERRO ao adicionar permissão:', error);
        logSystemEventFromClient({
          tipo: 'FUNCTION_ERROR',
          origem: 'frontend:useScreenPermissions',
          mensagem: 'Erro ao adicionar permissão de tela',
          detalhes: {
            screenId,
            screenName,
            role,
            error: error.message
          }
        });
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
        setHasUnsyncedChanges(true);
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

  const handleRefetch = async () => {
    await fetchData();
    setHasUnsyncedChanges(false);
  };

  return {
    screens,
    permissions,
    loading,
    operationLoading,
    hasUnsyncedChanges,
    togglePermission,
    hasPermission,
    isOperationLoading,
    refetch: handleRefetch,
  };
};
