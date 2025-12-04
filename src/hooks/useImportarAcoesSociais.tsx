import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AcaoSocialExcel } from "@/lib/excelAcoesSociaisParser";

interface ImportResult {
  success: boolean;
  inseridos: number;
  duplicados: number;
  erros: { linha: number; motivo: string }[];
  total_processados: number;
}

interface ImportParams {
  dados_excel: AcaoSocialExcel[];
  admin_profile_id: string;
  regional_id?: string;
}

export const useImportarAcoesSociais = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ImportParams): Promise<ImportResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/import-acoes-sociais`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar ações sociais');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalida cache para atualizar listagens
      queryClient.invalidateQueries({ queryKey: ['acoes-sociais-lista'] });
      
      if (data.inseridos > 0) {
        toast({
          title: "Importação concluída!",
          description: `${data.inseridos} ações importadas com sucesso.${data.duplicados > 0 ? ` ${data.duplicados} duplicadas ignoradas.` : ''}`,
        });
      } else if (data.duplicados > 0) {
        toast({
          title: "Nenhuma nova ação",
          description: `Todas as ${data.duplicados} ações já existiam no sistema.`,
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
