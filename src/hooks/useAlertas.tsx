import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface AlertaLog {
  id: string;
  run_id: string;
  tipo_alerta: string;
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  email_destinatario: string;
  destinatario_nome: string | null;
  destinatario_cargo: string | null;
  dias_atraso: number;
  valor_total: number;
  total_parcelas: number;
  status: string;
  message_id: string | null;
  erro_mensagem: string | null;
  motivo_ignorado: string | null;
  enviado_em: string | null;
  payload_hash: string | null;
  template_version: string | null;
  email_cc: string[] | null;
}

export const useAlertas = (filters?: {
  divisao?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}) => {
  const { data: alertas = [], isLoading, error, refetch } = useQuery({
    queryKey: ['alertas-inadimplencia', filters],
    queryFn: async () => {
      console.log('[useAlertas] Buscando alertas com filtros:', filters);
      
      let query = supabase
        .from('alertas_emails_log')
        .select('*')
        .neq('tipo_alerta', 'CRON_SUMMARY')
        .order('enviado_em', { ascending: false });

      if (filters?.divisao) {
        query = query.eq('divisao_texto', filters.divisao);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.dataInicio) {
        query = query.gte('enviado_em', filters.dataInicio);
      }

      if (filters?.dataFim) {
        query = query.lte('enviado_em', filters.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useAlertas] Erro ao buscar alertas:', error);
        throw error;
      }

      console.log('[useAlertas] Alertas encontrados:', data?.length || 0);
      return data as AlertaLog[];
    },
  });

  // Realtime: subscrever mudanças em alertas_emails_log
  useEffect(() => {
    console.log('[useAlertas] Configurando realtime subscription...');
    
    const channel = supabase
      .channel('alertas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alertas_emails_log',
        },
        (payload) => {
          console.log('[useAlertas] 🔄 Mudança detectada:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('[useAlertas] Removendo realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return {
    alertas,
    isLoading,
    error,
    refetch,
  };
};
