import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FrequenciaParams {
  dataInicio: Date;
  dataFim: Date;
  divisaoIds?: string[];
  regionalId?: string | null;
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
  cargo_nome?: string | null;
  grau?: string | null;
}

export interface IntegranteFrequencia {
  integrante_id: string;
  nome_colete: string;
  divisao: string;
  divisao_id?: string;
  regional_id?: string;
  regional_texto?: string;
  eventos: EventoDetalhe[];
  pontosObtidos: number;
  pontosMaximos: number;
  percentual: number;
  totalEventos: number;
}

// Função para mapear justificativa_ausencia para o formato padronizado
const mapearJustificativa = (ausencia: string | null, tipo: string | null): string => {
  // Priorizar justificativa_tipo se existir e for válido
  if (tipo && tipo.trim() !== '' && !['(outra divisão)', 'Presente', ''].includes(tipo)) {
    return tipo;
  }
  
  // Mapear justificativa_ausencia para formato com acentos/capitalizado
  if (!ausencia || ausencia.trim() === '') return 'Não justificou';
  
  const mapeamento: Record<string, string> = {
    'trabalho': 'Trabalho',
    'familia': 'Família',
    'família': 'Família',
    'saude': 'Saúde',
    'saúde': 'Saúde',
    'nao_justificado': 'Não justificou',
    'nao justificado': 'Não justificou',
    'não justificou': 'Não justificou',
    'viagem': 'Viagem',
    'outro': 'Outro',
    'outra': 'Outro',
  };
  
  const chave = ausencia.toLowerCase().trim();
  return mapeamento[chave] || ausencia; // Retorna o original se não encontrar mapeamento
};

export const useFrequenciaPonderada = ({
  dataInicio,
  dataFim,
  divisaoIds,
  regionalId,
  tiposEvento,
}: FrequenciaParams) => {
  return useQuery({
    queryKey: ['frequencia-ponderada', dataInicio, dataFim, divisaoIds, regionalId, tiposEvento],
    queryFn: async () => {
      console.log('[useFrequenciaPonderada] Iniciando cálculo', {
        dataInicio,
        dataFim,
        divisaoIds,
        regionalId,
        tiposEvento,
      });

      // 1. Buscar eventos do período com peso (limitado até hoje)
      const hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      const dataFimReal = dataFim > hoje ? hoje : dataFim;
      
      let queryEventos = supabase
        .from('eventos_agenda')
        .select(`
          id,
          titulo,
          data_evento,
          divisao_id,
          regional_id,
          tipo_evento_peso
        `)
        .gte('data_evento', dataInicio.toISOString())
        .lte('data_evento', dataFimReal.toISOString());

      // Filtrar por divisões E/OU regional
      if (divisaoIds && divisaoIds.length > 0 && regionalId) {
        // Buscar eventos das divisões especificadas OU eventos da regional (sem divisão específica)
        queryEventos = queryEventos.or(`divisao_id.in.(${divisaoIds.join(',')}),regional_id.eq.${regionalId}`);
      } else if (divisaoIds && divisaoIds.length > 0) {
        queryEventos = queryEventos.in('divisao_id', divisaoIds);
      } else if (regionalId) {
        queryEventos = queryEventos.eq('regional_id', regionalId);
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
            divisao_id,
            regional_id,
            regional_texto,
            cargo_nome,
            grau,
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
      // Filtrar presenças por regional se especificado (para garantir escopo correto)
      const presencasFiltradas = regionalId 
        ? presencas?.filter(p => p.integrantes_portal.regional_id === regionalId)
        : presencas;
      
      const integrantesMap = new Map<string, IntegranteFrequencia>();

      presencasFiltradas?.forEach(p => {
        const key = p.integrante_id;
        
        if (!integrantesMap.has(key)) {
          integrantesMap.set(key, {
            integrante_id: key,
            nome_colete: p.integrantes_portal.nome_colete,
            divisao: p.integrantes_portal.divisao_texto,
            divisao_id: p.integrantes_portal.divisao_id,
            regional_id: p.integrantes_portal.regional_id,
            regional_texto: p.integrantes_portal.regional_texto,
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
        let justificativaReal: string | null = null;
        
        if (p.status === 'ausente') {
          // Mapear justificativa_ausencia para formato padronizado
          justificativaReal = mapearJustificativa(p.justificativa_ausencia, p.justificativa_tipo);
          pesoPresenca = justificativasMap.get(justificativaReal) || 0.001;
        }

        const pontos = pesoEvento * pesoPresenca;
        integrante.pontosObtidos += pontos;
        integrante.pontosMaximos += pesoEvento;
        integrante.totalEventos += 1;

        integrante.eventos.push({
          titulo: evento.titulo,
          data: evento.data_evento,
          status: p.status,
          justificativa: justificativaReal,
          pesoEvento,
          pesoPresenca,
          pontos,
          cargo_nome: p.integrantes_portal.cargo_nome,
          grau: p.integrantes_portal.grau,
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
