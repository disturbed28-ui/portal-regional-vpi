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
      const { data: cargas, error } = await supabase
        .from('cargas_historico')
        .select('data_carga, total_integrantes, dados_snapshot')
        .order('data_carga', { ascending: true });

      if (error) {
        console.error('Erro ao buscar histórico de cargas:', error);
        throw error;
      }

      if (!cargas || cargas.length === 0) {
        return null;
      }

      // Processar dados
      const cargasProcessadas: CargaHistorica[] = cargas.map(carga => {
        const snapshot = carga.dados_snapshot as { divisoes?: DivisaoSnapshot[] };
        return {
          data_carga: carga.data_carga,
          total_integrantes: carga.total_integrantes,
          divisoes: snapshot.divisoes || []
        };
      });

      // Extrair todas as divisões únicas
      const divisoesSet = new Set<string>();
      cargasProcessadas.forEach(carga => {
        carga.divisoes.forEach(divisao => {
          divisoesSet.add(divisao.nome);
        });
      });

      const divisoesUnicas = Array.from(divisoesSet).sort();

      const periodo = {
        inicio: cargasProcessadas[0].data_carga,
        fim: cargasProcessadas[cargasProcessadas.length - 1].data_carga
      };

      return {
        cargas: cargasProcessadas,
        periodo,
        divisoesUnicas
      };
    },
  });
};
