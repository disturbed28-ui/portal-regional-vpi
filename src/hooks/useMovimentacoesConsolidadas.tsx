import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarDivisao } from "@/lib/normalizeText";

export type TipoMovimentacaoConsolidada = 'ENTRADA' | 'SAIDA' | 'INATIVACAO' | 'REATIVACAO' | 'NOVO_ATIVOS' | 'SUMIU_ATIVOS';

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
 * Gera chave de deduplicação completa
 */
const gerarChaveDedup = (m: MovimentacaoConsolidada): string => {
  const dataBase = m.data_movimentacao?.split('T')[0] || '';
  const origemNorm = normalizarDivisao(m.origem_divisao || '');
  const destinoNorm = normalizarDivisao(m.destino_divisao || '');
  return `${m.registro_id}_${m.tipo}_${dataBase}_${origemNorm}_${destinoNorm}`;
};

/**
 * Hook unificado para movimentações consolidadas
 * Classifica automaticamente como ENTRADA ou SAIDA baseado na divisão
 * Fonte única da verdade para FormularioRelatorioSemanal e HistoricoMovimentacoes
 * 
 * Fontes de dados:
 * 1. atualizacoes_carga (campo_alterado = 'divisao_texto') - Mudanças de divisão
 * 2. atualizacoes_carga (campo_alterado = 'ativo') - Inativações/Reativações
 * 3. atualizacoes_carga (campo_alterado = 'regional_texto') - Mudanças de regional
 * 4. deltas_pendentes (tipo_delta = 'SUMIU_ATIVOS' ou 'NOVO_ATIVOS') - Integrantes que sumiram ou apareceram
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

      // 3. Buscar mudanças de regional no período
      const { data: mudancasRegional, error: errorRegional } = await supabase
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
        .eq('campo_alterado', 'regional_texto')
        .gte('created_at', options.dataInicio.toISOString())
        .lte('created_at', options.dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (errorRegional) {
        console.error('[useMovimentacoesConsolidadas] Erro ao buscar mudanças de regional:', errorRegional);
        throw errorRegional;
      }

      // 4. Buscar deltas SUMIU_ATIVOS e NOVO_ATIVOS no período
      const { data: deltasPendentes, error: errorDeltas } = await supabase
        .from('deltas_pendentes')
        .select(`
          id,
          registro_id,
          nome_colete,
          divisao_texto,
          divisao_id,
          tipo_delta,
          created_at,
          dados_adicionais
        `)
        .in('tipo_delta', ['SUMIU_ATIVOS', 'NOVO_ATIVOS'])
        .gte('created_at', options.dataInicio.toISOString())
        .lte('created_at', options.dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (errorDeltas) {
        console.error('[useMovimentacoesConsolidadas] Erro ao buscar deltas pendentes:', errorDeltas);
        // Não falhar, apenas logar - deltas são complementares
      }

      // 5. Buscar informações atuais dos integrantes para contexto
      const integranteIds = new Set<string>();
      [...(mudancasDivisao || []), ...(mudancasAtivo || []), ...(mudancasRegional || [])].forEach(m => {
        if (m.integrante_id) integranteIds.add(m.integrante_id);
      });

      let integrantesMap = new Map<string, { divisao: string; regional: string }>();
      
      if (integranteIds.size > 0) {
        const { data: integrantes } = await supabase
          .from('integrantes_portal')
          .select('id, divisao_texto, regional_texto')
          .in('id', Array.from(integranteIds));
        
        (integrantes || []).forEach(i => {
          integrantesMap.set(i.id, { 
            divisao: i.divisao_texto,
            regional: i.regional_texto 
          });
        });
      }

      const entradas: MovimentacaoConsolidada[] = [];
      const saidas: MovimentacaoConsolidada[] = [];

      // 6. Processar mudanças de divisão
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

      // 7. Processar inativações e reativações
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

      // 8. Processar mudanças de regional
      (mudancasRegional || []).forEach(item => {
        // Verificar se integrante é desta divisão
        const infoAtual = item.integrante_id ? integrantesMap.get(item.integrante_id) : null;
        const divisaoIntegrante = infoAtual?.divisao ? normalizarDivisao(infoAtual.divisao) : null;

        // Se a divisão atual do integrante é a do relatório, é ENTRADA (veio de outra regional)
        if (divisaoIntegrante === divisaoNorm) {
          entradas.push({
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            tipo: 'ENTRADA',
            data_movimentacao: item.created_at,
            origem_divisao: `Regional: ${item.valor_anterior}`,
            destino_divisao: `Regional: ${item.valor_novo}`,
            detalhes: `Transferido de outra regional: ${item.valor_anterior}`
          });
        }
      });

      // 9. Processar deltas SUMIU_ATIVOS e NOVO_ATIVOS
      (deltasPendentes || []).forEach(delta => {
        const divisaoDelta = normalizarDivisao(delta.divisao_texto || '');
        
        // Só processar se for da divisão do relatório
        if (divisaoDelta !== divisaoNorm) return;
        
        if (delta.tipo_delta === 'SUMIU_ATIVOS') {
          saidas.push({
            id: delta.id,
            integrante_id: null,
            registro_id: delta.registro_id,
            nome_colete: delta.nome_colete,
            tipo: 'SUMIU_ATIVOS',
            data_movimentacao: delta.created_at,
            origem_divisao: delta.divisao_texto,
            detalhes: 'Não apareceu na carga (SUMIU_ATIVOS)'
          });
        } else if (delta.tipo_delta === 'NOVO_ATIVOS') {
          entradas.push({
            id: delta.id,
            integrante_id: null,
            registro_id: delta.registro_id,
            nome_colete: delta.nome_colete,
            tipo: 'NOVO_ATIVOS',
            data_movimentacao: delta.created_at,
            destino_divisao: delta.divisao_texto,
            detalhes: 'Novo integrante (NOVO_ATIVOS)'
          });
        }
      });

      // 10. Deduplicar por chave completa
      const deduplicar = (lista: MovimentacaoConsolidada[]): MovimentacaoConsolidada[] => {
        const vistos = new Set<string>();
        return lista.filter(m => {
          const chave = gerarChaveDedup(m);
          if (vistos.has(chave)) return false;
          vistos.add(chave);
          return true;
        });
      };

      console.log('[useMovimentacoesConsolidadas] Resultado:', {
        divisao: options.divisao,
        entradas: entradas.length,
        saidas: saidas.length,
        fonteMudancasDivisao: mudancasDivisao?.length || 0,
        fonteMudancasAtivo: mudancasAtivo?.length || 0,
        fonteMudancasRegional: mudancasRegional?.length || 0,
        fonteDeltas: deltasPendentes?.length || 0
      });

      return {
        entradas: deduplicar(entradas),
        saidas: deduplicar(saidas)
      };
    },
    enabled: !!options?.divisao && !!options?.dataInicio && !!options?.dataFim
  });
};

/**
 * Função auxiliar para gerar chave de deduplicação (exportada para uso no formulário)
 */
export const gerarChaveDedupMovimentacao = gerarChaveDedup;
