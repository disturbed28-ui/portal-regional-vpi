import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SystemSetting {
  id: string;
  chave: string;
  valor: boolean;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export function useSystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('chave');

      if (error) throw error;
      return data as SystemSetting[];
    }
  });

  const updateSetting = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: boolean }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ valor, updated_at: new Date().toISOString() })
        .eq('chave', chave);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: "Configuração atualizada",
        description: "As alterações foram salvas com sucesso",
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar configuração:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar a configuração",
        variant: "destructive",
      });
    }
  });

  const getSetting = (chave: string): SystemSetting | undefined => {
    return settings?.find((s) => s.chave === chave);
  };

  const getSettingValue = (chave: string): boolean => {
    return getSetting(chave)?.valor ?? true;
  };

  return {
    settings,
    isLoading,
    updateSetting,
    getSetting,
    getSettingValue,
  };
}
