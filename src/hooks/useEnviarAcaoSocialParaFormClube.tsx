import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useEnviarAcaoSocialParaFormClube = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (registro_id: string) => {
      console.log('[useEnviarAcaoSocial] Enviando registro:', registro_id);

      const { data, error } = await supabase.functions.invoke(
        'acoes-sociais-enviar-form',
        {
          body: { registro_id },
        }
      );

      if (error) {
        console.error('[useEnviarAcaoSocial] Erro da function:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[useEnviarAcaoSocial] Resposta de erro:', data);
        throw new Error(data?.error || 'Erro ao enviar para o formulário');
      }

      console.log('[useEnviarAcaoSocial] ✅ Sucesso:', data);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Enviado ao Formulário Oficial!",
        description: "A ação social foi registrada no sistema do motoclube.",
      });
      // Invalidar cache para atualizar o status na lista
      queryClient.invalidateQueries({ queryKey: ['acoes-sociais-lista'] });
    },
    onError: (error: any) => {
      console.error('[useEnviarAcaoSocial] ❌ Erro:', error);
      
      let errorMessage = error.message || 'Erro desconhecido ao enviar para o formulário';
      
      // Mensagens mais amigáveis
      if (errorMessage.includes('já foi enviado')) {
        errorMessage = 'Esta ação social já foi enviada ao formulário oficial.';
      } else if (errorMessage.includes('não tem permissão')) {
        errorMessage = 'Você não tem permissão para enviar esta ação social.';
      } else if (errorMessage.includes('não encontrada')) {
        errorMessage = 'Ação social não encontrada.';
      }

      toast({
        title: "Erro ao enviar ao formulário",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};
