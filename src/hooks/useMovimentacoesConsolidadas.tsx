import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarDivisao } from "@/lib/normalizeText";

export type TipoMovimentacaoConsolidada = 'ENTRADA' | 'SAIDA' | 'INATIVACAO' | 'REATIVACAO';

export interface MovimentacaoConsolidada {
  id: string;
  integrante_id: string | null;
  registro_id: number;
  nome_colete: string;
  tipo: TipoMovimentacaoConsolidada;
  data_movimentacao: string;
  origem_divisao?: string | null;
  destino_divisao?: string | null;
  detalhes?: string;
}

interface UseMovimentacoesConsolidadasOptions {
  divisao: string;
  dataInicio: Date;
  dataFim: Date;
}

/**
 * Hook unificado para movimentações consolidadas
 * Classifica automaticamente como ENTRADA ou SAIDA baseado na divisão
 * Fonte única da verdade para FormularioRelatorioSemanal e HistoricoMovimentacoes
 */
export const useMovimentacoesConsolidadas = (options: UseMovimentacoesConsolidadasOptions | null) => {
  return useQuery({
    queryKey: ['movimentacoes-consolidadas', options?.divisao, options?.dataInicio?.toISOString(), options?.dataFim?.toISOString()],
    queryFn: async (): Promise<{ entradas: MovimentacaoConsolidada[]; saidas: MovimentacaoConsolidada[] }> => {
      if (!options?.divisao || !options?.dataInicio || !options?.dataFim) {
        return { entradas: [], saidas: [] };
      }

      const divisaoNorm = normalizarDivisao(options.divisao);

      // 1. Buscar mudanças de divisão no período
      const { data: mudancasDivisao, error: errorDivisao } = await supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at
        `)
        .eq('campo_alterado', 'divisao_texto')
        .gte('created_at', options.dataInicio.toISOString())
        .lte('created_at', options.dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (errorDivisao) {
        console.error('[useMovimentacoesConsolidadas] Erro ao buscar mudanças de divisão:', errorDivisao);
        throw errorDivisao;
      }

      // 2. Buscar inativações e reativações no período
      const { data: mudancasAtivo, error: errorAtivo } = await supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at
        `)
        .eq('campo_alterado', 'ativo')
        .gte('created_at', options.dataInicio.toISOString())
        .lte('created_at', options.dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (errorAtivo) {
        console.error('[useMovimentacoesConsolidadas] Erro ao buscar mudanças de ativo:', errorAtivo);
        throw errorAtivo;
      }

      // 3. Buscar informações atuais dos integrantes para contexto
      const integranteIds = new Set<string>();
      [...(mudancasDivisao || []), ...(mudancasAtivo || [])].forEach(m => {
        if (m.integrante_id) integranteIds.add(m.integrante_id);
      });

      let integrantesMap = new Map<string, { divisao: string }>();
      
      if (integranteIds.size > 0) {
        const { data: integrantes } = await supabase
          .from('integrantes_portal')
          .select('id, divisao_texto')
          .in('id', Array.from(integranteIds));
        
        (integrantes || []).forEach(i => {
          integrantesMap.set(i.id, { divisao: i.divisao_texto });
        });
      }

      const entradas: MovimentacaoConsolidada[] = [];
      const saidas: MovimentacaoConsolidada[] = [];

      // 4. Processar mudanças de divisão
      (mudancasDivisao || []).forEach(item => {
        const anteriorNorm = normalizarDivisao(item.valor_anterior || '');
        const novoNorm = normalizarDivisao(item.valor_novo || '');

        // Ignorar mudanças que são apenas formatação
        if (anteriorNorm === novoNorm) return;

        // SAÍDA: valor_anterior é a divisão do usuário
        if (anteriorNorm === divisaoNorm) {
          saidas.push({
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            tipo: 'SAIDA',
            data_movimentacao: item.created_at,
            origem_divisao: item.valor_anterior,
            destino_divisao: item.valor_novo,
            detalhes: `Transferido para: ${item.valor_novo || 'outra divisão'}`
          });
        }

        // ENTRADA: valor_novo é a divisão do usuário
        if (novoNorm === divisaoNorm) {
          entradas.push({
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            tipo: 'ENTRADA',
            data_movimentacao: item.created_at,
            origem_divisao: item.valor_anterior,
            destino_divisao: item.valor_novo,
            detalhes: `Veio de: ${item.valor_anterior || 'outra divisão'}`
          });
        }
      });

      // 5. Processar inativações e reativações
      (mudancasAtivo || []).forEach(item => {
        // Só válido se tem valor_novo explícito
        if (item.valor_novo !== 'true' && item.valor_novo !== 'false') return;

        // Verificar se integrante é/era desta divisão
        const infoAtual = item.integrante_id ? integrantesMap.get(item.integrante_id) : null;
        const divisaoIntegrante = infoAtual?.divisao ? normalizarDivisao(infoAtual.divisao) : null;

        // Só processar se o integrante pertence à divisão atual
        if (divisaoIntegrante !== divisaoNorm) return;

        if (item.valor_novo === 'false') {
          // INATIVAÇÃO: ativo true -> false
          saidas.push({
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            tipo: 'INATIVACAO',
            data_movimentacao: item.created_at,
            origem_divisao: infoAtual?.divisao,
            detalhes: 'Inativado'
          });
        } else if (item.valor_novo === 'true') {
          // REATIVAÇÃO: ativo false -> true
          entradas.push({
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            tipo: 'REATIVACAO',
            data_movimentacao: item.created_at,
            destino_divisao: infoAtual?.divisao,
            detalhes: 'Reativado'
          });
        }
      });

      // 6. Deduplicar por identificador único
      const deduplicar = (lista: MovimentacaoConsolidada[]): MovimentacaoConsolidada[] => {
        const vistos = new Set<string>();
        return lista.filter(m => {
          const chave = `${m.registro_id}_${m.tipo}_${m.data_movimentacao.split('T')[0]}`;
          if (vistos.has(chave)) return false;
          vistos.add(chave);
          return true;
        });
      };

      console.log('[useMovimentacoesConsolidadas] Resultado:', {
        divisao: options.divisao,
        entradas: entradas.length,
        saidas: saidas.length
      });

      return {
        entradas: deduplicar(entradas),
        saidas: deduplicar(saidas)
      };
    },
    enabled: !!options?.divisao && !!options?.dataInicio && !!options?.dataFim
  });
};
