import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FrequenciaParams {
  dataInicio: Date;
  dataFim: Date;
  divisaoIds?: string[];
  tiposEvento?: string[];
}

export interface EventoDetalhe {
  titulo: string;
  data: string;
  status: string;
  justificativa: string | null;
  pesoEvento: number;
  pesoPresenca: number;
  pontos: number;
}

export interface IntegranteFrequencia {
  integrante_id: string;
  nome_colete: string;
  divisao: string;
  eventos: EventoDetalhe[];
  pontosObtidos: number;
  pontosMaximos: number;
  percentual: number;
  totalEventos: number;
}

export const useFrequenciaPonderada = ({
  dataInicio,
  dataFim,
  divisaoIds,
  tiposEvento,
}: FrequenciaParams) => {
  return useQuery({
    queryKey: ['frequencia-ponderada', dataInicio, dataFim, divisaoIds, tiposEvento],
    queryFn: async () => {
      console.log('[useFrequenciaPonderada] Iniciando cálculo', {
        dataInicio,
        dataFim,
        divisaoIds,
        tiposEvento,
      });

      // 1. Buscar eventos do período com peso
      let queryEventos = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          tipo_evento_peso
        `)
        .gte('data_evento', dataInicio.toISOString())
        .lte('data_evento', dataFim.toISOString());

      if (divisaoIds && divisaoIds.length > 0) {
        queryEventos = queryEventos.in('divisao_id', divisaoIds);
      }

      const { data: eventos, error: eventosError } = await queryEventos;
      
      if (eventosError) {
        console.error('[useFrequenciaPonderada] Erro ao buscar eventos:', eventosError);
        throw eventosError;
      }

      console.log('[useFrequenciaPonderada] Eventos encontrados:', eventos?.length);

      if (!eventos || eventos.length === 0) {
        return [];
      }

      // 2. Buscar pesos dos tipos de evento
      const { data: pesosTipos, error: pesosError } = await supabase
        .from('tipos_evento_peso')
        .select('tipo, peso');

      if (pesosError) {
        console.error('[useFrequenciaPonderada] Erro ao buscar pesos:', pesosError);
        throw pesosError;
      }

      const pesosMap = new Map(pesosTipos?.map(p => [p.tipo, p.peso]) || []);

      // 3. Buscar todas as presenças desses eventos
      const eventoIds = eventos.map(e => e.id);
      const { data: presencas, error: presencasError } = await supabase
        .from('presencas')
        .select(`
          *,
          integrantes_portal!inner(
            nome_colete,
            divisao_texto,
            ativo
          )
        `)
        .in('evento_agenda_id', eventoIds)
        .neq('status', 'visitante');

      if (presencasError) {
        console.error('[useFrequenciaPonderada] Erro ao buscar presenças:', presencasError);
        throw presencasError;
      }

      console.log('[useFrequenciaPonderada] Presenças encontradas:', presencas?.length);

      // 4. Buscar pesos das justificativas
      const { data: pesosJustificativas } = await supabase
        .from('justificativas_peso')
        .select('tipo, peso');

      const justificativasMap = new Map(pesosJustificativas?.map(j => [j.tipo, j.peso]) || []);

      // 5. Agrupar por integrante e calcular pontuação
      const integrantesMap = new Map<string, IntegranteFrequencia>();

      presencas?.forEach(p => {
        const key = p.integrante_id;
        
        if (!integrantesMap.has(key)) {
          integrantesMap.set(key, {
            integrante_id: key,
            nome_colete: p.integrantes_portal.nome_colete,
            divisao: p.integrantes_portal.divisao_texto,
            eventos: [],
            pontosObtidos: 0,
            pontosMaximos: 0,
            totalEventos: 0,
            percentual: 0,
          });
        }

        const integrante = integrantesMap.get(key)!;
        const evento = eventos.find(e => e.id === p.evento_agenda_id);
        
        if (!evento) return;

        const pesoEvento = pesosMap.get(evento.tipo_evento_peso || '') || 1;
        
        let pesoPresenca = 1;
        if (p.status === 'ausente') {
          const justificativaTipo = p.justificativa_tipo || 'Não justificou';
          pesoPresenca = justificativasMap.get(justificativaTipo) || 0.001;
        }

        const pontos = pesoEvento * pesoPresenca;
        integrante.pontosObtidos += pontos;
        integrante.pontosMaximos += pesoEvento;
        integrante.totalEventos += 1;

        integrante.eventos.push({
          titulo: evento.titulo,
          data: evento.data_evento,
          status: p.status,
          justificativa: p.justificativa_tipo,
          pesoEvento,
          pesoPresenca,
          pontos,
        });
      });

      // 6. Calcular percentual e ordenar
      const resultado = Array.from(integrantesMap.values())
        .map(i => ({
          ...i,
          percentual: i.pontosMaximos > 0 ? (i.pontosObtidos / i.pontosMaximos) * 100 : 0,
        }))
        .sort((a, b) => b.percentual - a.percentual);

      console.log('[useFrequenciaPonderada] Resultado calculado:', resultado.length);

      return resultado;
    },
    staleTime: 5 * 60 * 1000, // Cache de 5 minutos
  });
};
