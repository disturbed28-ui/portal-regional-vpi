import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarRegional, normalizarDivisao } from "@/lib/normalizeText";

export interface MovimentacaoIntegrante {
  id: string;
  integrante_id: string | null;
  registro_id: number;
  nome_colete: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  data_movimentacao: string;
  data_carga: string | null;
  carga_id: string | null;
  tipo_movimentacao: 'MUDANCA_DIVISAO' | 'MUDANCA_REGIONAL' | 'INATIVACAO' | 'REATIVACAO' | 'OUTRO';
  divisao_atual?: string | null;
  regional_atual?: string | null;
}

interface UseMovimentacoesOptions {
  divisao?: string;
  dataInicio?: Date;
  dataFim?: Date;
  tipos?: string[];
}

// Interface para o novo hook com filtro por integrantes atuais
interface UseMovimentacoesComFiltroOptions {
  integrantesDaDivisao?: string;    // Busca histórico de quem está HOJE nessa divisão
  integrantesDaRegional?: string;   // Busca histórico de quem está HOJE nessa regional
  tipos?: string[];
}

// Hook para buscar movimentações de integrantes
export const useMovimentacoesIntegrantes = (options?: UseMovimentacoesOptions) => {
  return useQuery({
    queryKey: ['movimentacoes-integrantes', options?.divisao, options?.dataInicio?.toISOString(), options?.dataFim?.toISOString(), options?.tipos],
    queryFn: async (): Promise<MovimentacaoIntegrante[]> => {
      // Buscar da tabela atualizacoes_carga diretamente (a view pode não estar no types ainda)
      let query = supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .in('campo_alterado', ['divisao_texto', 'regional_texto', 'ativo'])
        .order('created_at', { ascending: false });

      // Filtro por período
      if (options?.dataInicio) {
        query = query.gte('created_at', options.dataInicio.toISOString());
      }
      if (options?.dataFim) {
        query = query.lte('created_at', options.dataFim.toISOString() + 'T23:59:59');
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
      }

      // Mapear para o formato esperado
      let movimentacoes: MovimentacaoIntegrante[] = (data || [])
        // Filtrar primeiro: remover mudanças que não são reais (apenas normalização de texto)
        .filter(item => isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo))
        .map(item => ({
          id: item.id,
          integrante_id: item.integrante_id,
          registro_id: item.registro_id,
          nome_colete: item.nome_colete,
          campo_alterado: item.campo_alterado,
          valor_anterior: item.valor_anterior,
          valor_novo: item.valor_novo,
          data_movimentacao: item.created_at,
          data_carga: null,
          carga_id: item.carga_historico_id,
          tipo_movimentacao: getTipoMovimentacao(item.campo_alterado, item.valor_novo)
        }));

      // Filtrar por divisão se especificado (entrada ou saída da divisão)
      if (options?.divisao) {
        return movimentacoes.filter(m => 
          m.valor_anterior === options.divisao || m.valor_novo === options.divisao
        );
      }

      // Filtrar por tipos se especificado
      if (options?.tipos && options.tipos.length > 0) {
        return movimentacoes.filter(m => options.tipos!.includes(m.tipo_movimentacao));
      }

      return movimentacoes;
    },
    enabled: true
  });
};

// Helper para determinar tipo de movimentação
const getTipoMovimentacao = (campo: string, valorNovo: string | null): MovimentacaoIntegrante['tipo_movimentacao'] => {
  if (campo === 'divisao_texto') return 'MUDANCA_DIVISAO';
  if (campo === 'regional_texto') return 'MUDANCA_REGIONAL';
  if (campo === 'ativo' && valorNovo === 'false') return 'INATIVACAO';
  if (campo === 'ativo' && valorNovo === 'true') return 'REATIVACAO';
  return 'OUTRO';
};

// Helper para verificar se é uma mudança real (não apenas normalização de texto)
const isMudancaReal = (campo: string, valorAnterior: string | null, valorNovo: string | null): boolean => {
  // Campo ativo: só é válido se valor_novo for 'true' ou 'false' explícito
  if (campo === 'ativo') {
    return valorNovo === 'true' || valorNovo === 'false';
  }
  
  // Campo divisão: comparar normalizado para evitar falsos positivos de formatação
  if (campo === 'divisao_texto') {
    const anteriorNorm = normalizarDivisao(valorAnterior || '');
    const novoNorm = normalizarDivisao(valorNovo || '');
    return anteriorNorm !== novoNorm;
  }
  
  // Campo regional: comparar normalizado
  if (campo === 'regional_texto') {
    const anteriorNorm = normalizarRegional(valorAnterior || '');
    const novoNorm = normalizarRegional(valorNovo || '');
    return anteriorNorm !== novoNorm;
  }
  
  return true;
};

// Hook com filtro baseado nos INTEGRANTES ATUAIS de uma divisão/regional
// Busca o histórico COMPLETO de quem está HOJE na divisão/regional
export const useMovimentacoesComFiltro = (options?: UseMovimentacoesComFiltroOptions) => {
  return useQuery({
    queryKey: ['movimentacoes-com-filtro', options?.integrantesDaDivisao, options?.integrantesDaRegional, options?.tipos],
    queryFn: async (): Promise<MovimentacaoIntegrante[]> => {
      // 1. Se houver filtro por divisão/regional, primeiro buscar os IDs dos integrantes atuais
      let integranteIds: string[] | null = null;
      let integrantesMap: Map<string, { divisao: string; regional: string }> = new Map();
      
      if (options?.integrantesDaDivisao) {
        // Buscar integrantes que estão HOJE nessa divisão
        // Usar busca normalizada para evitar problemas de case/acentos
        const { data: integrantes, error: intError } = await supabase
          .from('integrantes_portal')
          .select('id, divisao_texto, regional_texto')
          .eq('ativo', true);
        
        if (intError) {
          console.error('Erro ao buscar integrantes da divisão:', intError);
          throw intError;
        }
        
        // Filtrar localmente com normalização
        const divisaoNormalizada = normalizarDivisao(options.integrantesDaDivisao);
        const integrantesFiltrados = (integrantes || []).filter(i => 
          normalizarDivisao(i.divisao_texto) === divisaoNormalizada
        );
        
        integranteIds = integrantesFiltrados.map(i => i.id);
        integrantesFiltrados.forEach(i => {
          integrantesMap.set(i.id, { divisao: i.divisao_texto, regional: i.regional_texto });
        });
      } else if (options?.integrantesDaRegional) {
        // Buscar integrantes que estão HOJE nessa regional
        // Usar busca normalizada para evitar problemas de case/acentos/romanos
        const { data: integrantes, error: intError } = await supabase
          .from('integrantes_portal')
          .select('id, divisao_texto, regional_texto')
          .eq('ativo', true);
        
        if (intError) {
          console.error('Erro ao buscar integrantes da regional:', intError);
          throw intError;
        }
        
        // Filtrar localmente com normalização (converte VP III → VP 3)
        const regionalNormalizada = normalizarRegional(options.integrantesDaRegional);
        const integrantesFiltrados = (integrantes || []).filter(i => 
          normalizarRegional(i.regional_texto) === regionalNormalizada
        );
        
        integranteIds = integrantesFiltrados.map(i => i.id);
        integrantesFiltrados.forEach(i => {
          integrantesMap.set(i.id, { divisao: i.divisao_texto, regional: i.regional_texto });
        });
      } else {
        // Sem filtro - buscar todos os integrantes ativos para o mapa
        const { data: integrantes } = await supabase
          .from('integrantes_portal')
          .select('id, divisao_texto, regional_texto')
          .eq('ativo', true);
        
        (integrantes || []).forEach(i => {
          integrantesMap.set(i.id, { divisao: i.divisao_texto, regional: i.regional_texto });
        });
      }

      // 2. Buscar movimentações - com filtro de integrante_id se necessário
      let query = supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .in('campo_alterado', ['divisao_texto', 'regional_texto', 'ativo'])
        .order('created_at', { ascending: false });

      // Se tem lista de IDs, filtrar por eles
      if (integranteIds !== null) {
        if (integranteIds.length === 0) {
          // Nenhum integrante na divisão/regional
          return [];
        }
        query = query.in('integrante_id', integranteIds);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
      }

      // 3. Mapear para o formato esperado, incluindo divisão atual
      // Filtrar primeiro: remover mudanças que não são reais (apenas normalização de texto)
      let movimentacoes: MovimentacaoIntegrante[] = (data || [])
        .filter(item => isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo))
        .map(item => {
          const infoAtual = item.integrante_id ? integrantesMap.get(item.integrante_id) : null;
          return {
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            campo_alterado: item.campo_alterado,
            valor_anterior: item.valor_anterior,
            valor_novo: item.valor_novo,
            data_movimentacao: item.created_at,
            data_carga: null,
            carga_id: item.carga_historico_id,
            tipo_movimentacao: getTipoMovimentacao(item.campo_alterado, item.valor_novo),
            divisao_atual: infoAtual?.divisao || null,
            regional_atual: infoAtual?.regional || null
          };
        });

      // 4. Filtrar por tipos se especificado
      if (options?.tipos && options.tipos.length > 0) {
        movimentacoes = movimentacoes.filter(m => options.tipos!.includes(m.tipo_movimentacao));
      }

      return movimentacoes;
    },
    enabled: true
  });
};

// Hook específico para sugerir entradas/saídas da semana para uma divisão
export const useSugestoesEntradasSaidas = (divisao: string | null, dataInicio: Date | null, dataFim: Date | null) => {
  return useQuery({
    queryKey: ['sugestoes-entradas-saidas', divisao, dataInicio?.toISOString(), dataFim?.toISOString()],
    queryFn: async () => {
      if (!divisao || !dataInicio || !dataFim) {
        return { entradas: [], saidas: [] };
      }

      const { data, error } = await supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .eq('campo_alterado', 'divisao_texto')
        .gte('created_at', dataInicio.toISOString())
        .lte('created_at', dataFim.toISOString() + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar sugestões:', error);
        throw error;
      }

      const entradas: MovimentacaoIntegrante[] = [];
      const saidas: MovimentacaoIntegrante[] = [];

      (data || []).forEach(item => {
        // Ignorar se não for mudança real (apenas normalização de texto)
        if (!isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo)) {
          return;
        }

        const mov: MovimentacaoIntegrante = {
          id: item.id,
          integrante_id: item.integrante_id,
          registro_id: item.registro_id,
          nome_colete: item.nome_colete,
          campo_alterado: item.campo_alterado,
          valor_anterior: item.valor_anterior,
          valor_novo: item.valor_novo,
          data_movimentacao: item.created_at,
          data_carga: null,
          carga_id: item.carga_historico_id,
          tipo_movimentacao: 'MUDANCA_DIVISAO'
        };

        // Usar comparação normalizada para entradas/saídas
        const divisaoNorm = normalizarDivisao(divisao);
        
        // Entrada: valor_novo = divisão selecionada (comparação normalizada)
        if (normalizarDivisao(item.valor_novo || '') === divisaoNorm) {
          entradas.push(mov);
        }
        // Saída: valor_anterior = divisão selecionada (comparação normalizada)
        if (normalizarDivisao(item.valor_anterior || '') === divisaoNorm) {
          saidas.push(mov);
          saidas.push(mov);
        }
      });

      return { entradas, saidas };
    },
    enabled: !!divisao && !!dataInicio && !!dataFim
  });
};
