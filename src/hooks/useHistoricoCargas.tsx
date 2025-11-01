import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DivisaoSnapshot {
  nome: string;
  total_atual: number;
}

interface CargaHistorica {
  data_carga: string;
  total_integrantes: number;
  divisoes: DivisaoSnapshot[];
}

interface HistoricoCompleto {
  cargas: CargaHistorica[];
  periodo: { inicio: string; fim: string };
  divisoesUnicas: string[];
}

export const useHistoricoCargas = () => {
  return useQuery({
    queryKey: ['historico-cargas'],
    queryFn: async (): Promise<HistoricoCompleto | null> => {
      console.log('🔍 [useHistoricoCargas] Iniciando busca...');
      
      const { data: cargas, error } = await supabase
        .from('cargas_historico')
        .select('data_carga, total_integrantes, dados_snapshot')
        .order('data_carga', { ascending: true });

      console.log('📊 [useHistoricoCargas] Resultado da query:', { 
        cargas, 
        error,
        totalCargas: cargas?.length 
      });

      if (error) {
        console.error('❌ [useHistoricoCargas] Erro ao buscar:', error);
        throw error;
      }

      if (!cargas || cargas.length === 0) {
        console.warn('⚠️ [useHistoricoCargas] Nenhuma carga encontrada');
        return null;
      }

      // Processar dados
      const cargasProcessadas: CargaHistorica[] = cargas.map((carga, index) => {
        console.log(`📦 [useHistoricoCargas] Processando carga ${index + 1}:`, {
          data_carga: carga.data_carga,
          total_integrantes: carga.total_integrantes,
          dados_snapshot_type: typeof carga.dados_snapshot,
          dados_snapshot: carga.dados_snapshot
        });

        const snapshot = carga.dados_snapshot as { divisoes?: DivisaoSnapshot[] };
        const divisoes = snapshot?.divisoes || [];
        
        console.log(`  ↳ Divisões extraídas: ${divisoes.length}`);
        
        return {
          data_carga: carga.data_carga,
          total_integrantes: carga.total_integrantes,
          divisoes
        };
      });

      console.log('✅ [useHistoricoCargas] Cargas processadas:', cargasProcessadas.length);

      // Extrair todas as divisões únicas
      const divisoesSet = new Set<string>();
      cargasProcessadas.forEach(carga => {
        carga.divisoes.forEach(divisao => {
          divisoesSet.add(divisao.nome);
        });
      });

      const divisoesUnicas = Array.from(divisoesSet).sort();
      console.log('📋 [useHistoricoCargas] Divisões únicas:', divisoesUnicas);

      const periodo = {
        inicio: cargasProcessadas[0].data_carga,
        fim: cargasProcessadas[cargasProcessadas.length - 1].data_carga
      };

      const resultado = {
        cargas: cargasProcessadas,
        periodo,
        divisoesUnicas
      };

      console.log('🎉 [useHistoricoCargas] Resultado final:', resultado);
      
      return resultado;
    },
  });
};
