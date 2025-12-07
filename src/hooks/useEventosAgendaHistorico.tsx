import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventoHistorico {
  id: string;
  titulo: string;
  data_evento: string;
  status_original: 'cancelled' | 'removed';
  divisao_id: string | null;
  regional_id: string | null;
  motivo_exclusao: string;
  excluido_em: string;
  excluido_por: string;
  excluido_por_nome: string | null;
  evento_original_id: string;
  evento_google_id: string;
  tipo_evento: string | null;
  evento_created_at: string | null;
  total_presencas: number;
  divisao_nome: string | null;
  regional_nome: string | null;
}

export interface PresencaHistorico {
  id: string;
  status: string;
  justificativa_ausencia: string | null;
  justificativa_tipo: string | null;
  confirmado_em: string | null;
  visitante_nome: string | null;
  visitante_tipo: string | null;
  integrante_nome: string | null;
}

export const useEventosAgendaHistorico = (userId: string | undefined, isAdmin: boolean) => {
  return useQuery({
    queryKey: ['eventos-agenda-historico', userId],
    queryFn: async (): Promise<EventoHistorico[]> => {
      // Buscar eventos arquivados
      const { data: eventosHistorico, error: eventosError } = await supabase
        .from('eventos_agenda_historico')
        .select(`
          id,
          titulo,
          data_evento,
          status_original,
          divisao_id,
          regional_id,
          motivo_exclusao,
          excluido_em,
          excluido_por,
          evento_original_id,
          evento_google_id,
          tipo_evento,
          evento_created_at
        `)
        .order('excluido_em', { ascending: false });

      if (eventosError) {
        console.error('[useEventosAgendaHistorico] Erro ao buscar histórico:', eventosError);
        throw eventosError;
      }

      if (!eventosHistorico || eventosHistorico.length === 0) {
        return [];
      }

      // Buscar contagem de presenças por evento
      const eventosIds = eventosHistorico.map(e => e.id);
      const { data: presencasCounts, error: presencasError } = await supabase
        .from('presencas_historico')
        .select('evento_historico_id')
        .in('evento_historico_id', eventosIds);

      if (presencasError) {
        console.error('[useEventosAgendaHistorico] Erro ao buscar presenças:', presencasError);
      }

      // Contar presenças por evento
      const presencasCountMap: Record<string, number> = {};
      presencasCounts?.forEach(p => {
        presencasCountMap[p.evento_historico_id] = (presencasCountMap[p.evento_historico_id] || 0) + 1;
      });

      // Buscar nomes dos usuários que excluíram
      const userIds = [...new Set(eventosHistorico.map(e => e.excluido_por).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome_colete')
        .in('id', userIds);

      const profilesMap: Record<string, string> = {};
      profiles?.forEach(p => {
        profilesMap[p.id] = p.nome_colete || 'Usuário desconhecido';
      });

      // Buscar nomes das divisões e regionais
      const divisaoIds = [...new Set(eventosHistorico.map(e => e.divisao_id).filter(Boolean))] as string[];
      const regionalIds = [...new Set(eventosHistorico.map(e => e.regional_id).filter(Boolean))] as string[];

      const [divisoesRes, regionaisRes] = await Promise.all([
        divisaoIds.length > 0 
          ? supabase.from('divisoes').select('id, nome').in('id', divisaoIds)
          : { data: [] },
        regionalIds.length > 0
          ? supabase.from('regionais').select('id, nome').in('id', regionalIds)
          : { data: [] }
      ]);

      const divisoesMap: Record<string, string> = {};
      divisoesRes.data?.forEach(d => {
        divisoesMap[d.id] = d.nome;
      });

      const regionaisMap: Record<string, string> = {};
      regionaisRes.data?.forEach(r => {
        regionaisMap[r.id] = r.nome;
      });

      // Montar resultado final
      return eventosHistorico.map(evento => ({
        ...evento,
        status_original: evento.status_original as 'cancelled' | 'removed',
        excluido_por_nome: profilesMap[evento.excluido_por] || null,
        total_presencas: presencasCountMap[evento.id] || 0,
        divisao_nome: evento.divisao_id ? divisoesMap[evento.divisao_id] || null : null,
        regional_nome: evento.regional_id ? regionaisMap[evento.regional_id] || null : null,
      }));
    },
    enabled: !!userId && isAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnMount: true,
  });
};

export const usePresencasEventoHistorico = (eventoHistoricoId: string | null) => {
  return useQuery({
    queryKey: ['presencas-evento-historico', eventoHistoricoId],
    queryFn: async (): Promise<PresencaHistorico[]> => {
      if (!eventoHistoricoId) return [];

      const { data: presencas, error } = await supabase
        .from('presencas_historico')
        .select(`
          id,
          status,
          justificativa_ausencia,
          justificativa_tipo,
          confirmado_em,
          visitante_nome,
          visitante_tipo,
          integrante_id
        `)
        .eq('evento_historico_id', eventoHistoricoId);

      if (error) {
        console.error('[usePresencasEventoHistorico] Erro:', error);
        throw error;
      }

      if (!presencas || presencas.length === 0) {
        return [];
      }

      // Buscar nomes dos integrantes
      const integranteIds = presencas
        .map(p => p.integrante_id)
        .filter(Boolean) as string[];

      const { data: integrantes } = integranteIds.length > 0
        ? await supabase
            .from('integrantes_portal')
            .select('id, nome_colete')
            .in('id', integranteIds)
        : { data: [] };

      const integrantesMap: Record<string, string> = {};
      integrantes?.forEach(i => {
        integrantesMap[i.id] = i.nome_colete;
      });

      return presencas.map(p => ({
        id: p.id,
        status: p.status,
        justificativa_ausencia: p.justificativa_ausencia,
        justificativa_tipo: p.justificativa_tipo,
        confirmado_em: p.confirmado_em,
        visitante_nome: p.visitante_nome,
        visitante_tipo: p.visitante_tipo,
        integrante_nome: p.integrante_id ? integrantesMap[p.integrante_id] || null : null,
      }));
    },
    enabled: !!eventoHistoricoId,
  });
};
