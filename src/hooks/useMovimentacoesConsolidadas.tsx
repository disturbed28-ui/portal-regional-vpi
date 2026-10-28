import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { lerMovimentacoesCMD, type UseMovimentacoesConsolidadasOptions, type MovimentacaoConsolidada } from '../../supabase/functions/_shared/movimentacoes-cmd';
export type { TipoMovimentacaoConsolidada, MovimentacaoConsolidada } from '../../supabase/functions/_shared/movimentacoes-cmd';

/**
 * Hook unificado para movimentações consolidadas
 * Classifica automaticamente como ENTRADA ou SAIDA baseado na divisão
 * Fonte única da verdade para FormularioRelatorioSemanal e HistoricoMovimentacoes
 */
export const useMovimentacoesConsolidadas = (options: UseMovimentacoesConsolidadasOptions | null) => {
  return useQuery({
    queryKey: ['movimentacoes-consolidadas', options?.divisao, options?.dataInicio?.toISOString(), options?.dataFim?.toISOString(), options?.incluirAfastamentos],
    queryFn: async (): Promise<{ entradas: MovimentacaoConsolidada[]; saidas: MovimentacaoConsolidada[] }> => {
      if (!options?.divisao || !options?.dataInicio || !options?.dataFim) {
        return { entradas: [], saidas: [] };
      }

      return lerMovimentacoesCMD(supabase, options);
    },
    enabled: !!options?.divisao && !!options?.dataInicio && !!options?.dataFim
  });
};
