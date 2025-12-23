import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FrequenciaParams {
  dataInicio: Date;
  dataFim: Date;
  divisaoIds?: string[];
  regionalId?: string | null;
  integrantesDivisaoId?: string | null; // Filtrar por divisão do INTEGRANTE (para Grau VI)
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
  integrantesDivisaoId,
  tiposEvento,
}: FrequenciaParams) => {
  return useQuery({
    queryKey: ['frequencia-ponderada', dataInicio, dataFim, divisaoIds, regionalId, integrantesDivisaoId, tiposEvento],
    queryFn: async () => {
      // Log de versão para confirmar código atualizado
      console.log('[useFrequenciaPonderada] VERSÃO: 2025-12-23T15:05 - Limite 10000');
      
      console.log('[useFrequenciaPonderada] Iniciando cálculo', {
        dataInicio,
        dataFim,
        divisaoIds,
        regionalId,
        integrantesDivisaoId,
        tiposEvento,
      });

      // 1. Buscar TODOS os eventos do período (sem filtro de divisão/regional)
      // A filtragem será feita por INTEGRANTE, não por evento
      const hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      const dataFimReal = dataFim > hoje ? hoje : dataFim;
      
      const { data: eventos, error: eventosError } = await supabase
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
      
      if (eventosError) {
        console.error('[useFrequenciaPonderada] Erro ao buscar eventos:', eventosError);
        throw eventosError;
      }

      console.log('[useFrequenciaPonderada] Eventos encontrados:', eventos?.length);
      console.log('[useFrequenciaPonderada] IDs dos eventos:', eventos?.map(e => e.id));

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

      // 3. Buscar todas as presenças desses eventos usando paginação
      // O Supabase tem limite máximo de 1000 por requisição no PostgREST
      const eventoIds = eventos.map(e => e.id);
      let allPresencas: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      console.log('[useFrequenciaPonderada] VERSÃO: 2025-12-23T16:00 - Buscando com paginação');

      while (hasMore) {
        const { data: presencasPage, error: presencasError } = await supabase
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
          .neq('status', 'visitante')
          .range(offset, offset + pageSize - 1);

        if (presencasError) {
          console.error('[useFrequenciaPonderada] Erro ao buscar presenças:', presencasError);
          throw presencasError;
        }

        if (presencasPage && presencasPage.length > 0) {
          allPresencas = [...allPresencas, ...presencasPage];
          offset += pageSize;
          hasMore = presencasPage.length === pageSize;
          console.log(`[useFrequenciaPonderada] Página carregada: ${presencasPage.length} presenças, total: ${allPresencas.length}`);
        } else {
          hasMore = false;
        }
      }

      const presencas = allPresencas;
      console.log('[useFrequenciaPonderada] Total de presenças carregadas:', presencas?.length);
      
      // DEBUG: Log específico para Painkiller
      const painkillerPresencasAntesFiltro = presencas?.filter(p => 
        p.integrantes_portal.nome_colete?.toLowerCase().includes('painkiller') ||
        p.integrantes_portal.nome_colete?.toLowerCase().includes('pain killer')
      );
      console.log('[DEBUG Painkiller] Presenças ANTES do filtro por divisão:', 
        painkillerPresencasAntesFiltro?.length, 
        painkillerPresencasAntesFiltro?.map(p => ({
          evento_id: p.evento_agenda_id,
          status: p.status,
          divisao_id: p.integrantes_portal.divisao_id,
          nome: p.integrantes_portal.nome_colete
        }))
      );

      // 4. Buscar pesos das justificativas
      const { data: pesosJustificativas } = await supabase
        .from('justificativas_peso')
        .select('tipo, peso');

      const justificativasMap = new Map(pesosJustificativas?.map(j => [j.tipo, j.peso]) || []);

      // 5. Agrupar por integrante e calcular pontuação
      // Filtrar presenças pelo INTEGRANTE (não pelo evento):
      // - Por divisão do integrante (quando uma divisão específica é selecionada)
      // - Por regional do integrante (quando "todas" + usuário é Grau V)
      let presencasFiltradas = presencas;
      
      if (integrantesDivisaoId) {
        // Filtrar por divisão do INTEGRANTE (mostra todos eventos que esse integrante participou)
        presencasFiltradas = presencas?.filter(p => 
          p.integrantes_portal.divisao_id === integrantesDivisaoId
        );
        console.log('[useFrequenciaPonderada] Filtrando por divisão do integrante:', integrantesDivisaoId, 'Presenças:', presencasFiltradas?.length);
        
        // DEBUG: Log específico para Painkiller após filtro
        const painkillerAposFiltro = presencasFiltradas?.filter(p => 
          p.integrantes_portal.nome_colete?.toLowerCase().includes('painkiller') ||
          p.integrantes_portal.nome_colete?.toLowerCase().includes('pain killer')
        );
        console.log('[DEBUG Painkiller] Presenças APÓS filtro por divisão:', 
          painkillerAposFiltro?.length,
          painkillerAposFiltro?.map(p => ({
            evento_id: p.evento_agenda_id,
            status: p.status,
            divisao_id: p.integrantes_portal.divisao_id,
            nome: p.integrantes_portal.nome_colete
          }))
        );
      } else if (regionalId) {
        // Filtrar por regional do INTEGRANTE (mostra todos eventos que integrantes dessa regional participaram)
        presencasFiltradas = presencas?.filter(p => 
          p.integrantes_portal.regional_id === regionalId
        );
        console.log('[useFrequenciaPonderada] Filtrando por regional do integrante:', regionalId, 'Presenças:', presencasFiltradas?.length);
      }
      
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
        
        if (!evento) {
          // DEBUG: Log quando evento não é encontrado
          const isPainkiller = p.integrantes_portal.nome_colete?.toLowerCase().includes('painkiller') ||
            p.integrantes_portal.nome_colete?.toLowerCase().includes('pain killer');
          if (isPainkiller) {
            console.warn('[DEBUG Painkiller] EVENTO NÃO ENCONTRADO:', {
              presenca_id: p.id,
              evento_agenda_id: p.evento_agenda_id,
              integrante: p.integrantes_portal.nome_colete,
              eventoIds_disponiveis: eventos.map(e => e.id)
            });
          }
          return;
        }

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
    staleTime: 30 * 1000, // Cache de 30 segundos (temporário para debug)
    refetchOnWindowFocus: true, // Forçar recarregamento ao voltar à aba
  });
};
