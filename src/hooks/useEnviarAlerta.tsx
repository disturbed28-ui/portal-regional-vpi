import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnviarAlertaParams {
  tipo_alerta: 'INADIMPLENCIA_70_DIAS';
  divisao_id: string;
  dry_run?: boolean;
  test_email?: string;
}

interface EnviarAlertaResponse {
  success: boolean;
  dry_run?: boolean;
  run_id?: string;
  divisao: string;
  diretor?: { nome: string; email: string };
  total_devedores?: number;
  devedores_encontrados?: number;
  emails_enviados: number;
  emails_ignorados?: number;
  emails_erro?: number;
  preview?: any[];
  logs?: any[];
  message?: string;
}

export const useEnviarAlerta = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EnviarAlertaParams): Promise<EnviarAlertaResponse> => {
      console.log('[useEnviarAlerta] Enviando alerta:', params);

      const { data, error } = await supabase.functions.invoke('enviar-alerta-inadimplencia', {
        body: params,
      });

      if (error) {
        console.error('[useEnviarAlerta] Erro ao enviar alerta:', error);
        throw new Error(error.message || 'Erro ao enviar alerta');
      }

      console.log('[useEnviarAlerta] Resposta recebida:', data);
      return data as EnviarAlertaResponse;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info('Dry-Run Concluído', {
          description: `${data.devedores_encontrados || 0} devedor(es) encontrado(s). Nenhum email foi enviado.`,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['alertas-inadimplencia'] });
        
        if (data.emails_enviados > 0) {
          toast.success('Alertas Enviados', {
            description: `${data.emails_enviados} alerta(s) enviado(s) com sucesso para ${data.divisao}.`,
          });
        } else {
          toast.info('Nenhum Alerta Enviado', {
            description: data.message || 'Nenhum devedor elegível encontrado.',
          });
        }

        if (data.emails_erro && data.emails_erro > 0) {
          toast.warning('Alguns Alertas Falharam', {
            description: `${data.emails_erro} alerta(s) não puderam ser enviados. Verifique os logs.`,
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error('[useEnviarAlerta] Erro na mutation:', error);
      toast.error('Erro ao Enviar Alerta', {
        description: error.message || 'Ocorreu um erro ao processar sua solicitação.',
      });
    },
  });
};
