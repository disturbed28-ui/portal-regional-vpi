import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventoCanceladoPendente {
  id: string;
  evento_id: string;
  titulo: string;
  data_evento: string;
  status: 'cancelled' | 'removed';
  divisao_id: string | null;
  divisao_nome: string | null;
  regional_id: string | null;
  regional_nome: string | null;
  tipo_evento: string | null;
  created_at: string;
  total_presencas: number;
}

/**
 * Hook para buscar eventos cancelados/removidos que ainda têm lista de presença
 * (delta de eventos problemáticos que impactam aproveitamento)
 */
export const useEventosCanceladosPendentes = (userId: string | undefined, isAdmin: boolean) => {
  return useQuery({
    queryKey: ['eventos-cancelados-pendentes', userId, isAdmin],
    queryFn: async (): Promise<EventoCanceladoPendente[]> => {
      console.log('[useEventosCanceladosPendentes] Buscando eventos...');
      
      // Buscar eventos cancelados ou removidos
      const { data: eventos, error } = await supabase
        .from('eventos_agenda')
        .select(`
          id,
          evento_id,
          titulo,
          data_evento,
          status,
          divisao_id,
          regional_id,
          tipo_evento,
          created_at,
          divisoes:divisao_id (nome),
          regionais:regional_id (nome)
        `)
        .in('status', ['cancelled', 'removed'])
        .order('data_evento', { ascending: false });

      if (error) {
        console.error('[useEventosCanceladosPendentes] Erro:', error);
        throw error;
      }

      if (!eventos || eventos.length === 0) {
        console.log('[useEventosCanceladosPendentes] Nenhum evento cancelado/removido');
        return [];
      }

      // Para cada evento, buscar contagem de presenças
      const eventosComPresencas: EventoCanceladoPendente[] = [];
      
      for (const evento of eventos) {
        const { count } = await supabase
          .from('presencas')
          .select('*', { count: 'exact', head: true })
          .eq('evento_agenda_id', evento.id);

        // Só incluir eventos que têm presenças registradas
        if (count && count > 0) {
          eventosComPresencas.push({
            id: evento.id,
            evento_id: evento.evento_id,
            titulo: evento.titulo,
            data_evento: evento.data_evento,
            status: evento.status as 'cancelled' | 'removed',
            divisao_id: evento.divisao_id,
            divisao_nome: (evento.divisoes as any)?.nome || null,
            regional_id: evento.regional_id,
            regional_nome: (evento.regionais as any)?.nome || null,
            tipo_evento: evento.tipo_evento,
            created_at: evento.created_at || '',
            total_presencas: count
          });
        }
      }

      console.log('[useEventosCanceladosPendentes] Eventos com presenças:', eventosComPresencas.length);
      return eventosComPresencas;
    },
    enabled: !!userId && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnMount: true
  });
};
