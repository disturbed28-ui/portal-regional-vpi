import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
}

interface UseMovimentacoesOptions {
  divisao?: string;
  dataInicio?: Date;
  dataFim?: Date;
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
      const movimentacoes: MovimentacaoIntegrante[] = (data || []).map(item => ({
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

        // Entrada: valor_novo = divisão selecionada
        if (item.valor_novo === divisao) {
          entradas.push(mov);
        }
        // Saída: valor_anterior = divisão selecionada
        if (item.valor_anterior === divisao) {
          saidas.push(mov);
        }
      });

      return { entradas, saidas };
    },
    enabled: !!divisao && !!dataInicio && !!dataFim
  });
};
