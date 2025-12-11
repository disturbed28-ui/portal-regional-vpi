import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { normalizarNomeDivisao } from '@/lib/utils';

interface DivisaoSnapshot {
  divisao: string;
  total: number;
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

export const useHistoricoCargas = (options?: { enabled?: boolean; regionalId?: string }) => {
  return useQuery({
    queryKey: ['historico-cargas', options?.regionalId],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<HistoricoCompleto | null> => {
      // Se regionalId fornecido, buscar divisões dessa regional para filtrar
      let divisoesRegionalSet: Set<string> | null = null;
      if (options?.regionalId) {
        const { data: divisoesData } = await supabase
          .from('divisoes')
          .select('nome, nome_ascii')
          .eq('regional_id', options.regionalId);
        
        divisoesRegionalSet = new Set(
          divisoesData?.flatMap(d => [
            d.nome?.toUpperCase(),
            d.nome_ascii?.toUpperCase(),
            normalizarNomeDivisao(d.nome)?.toUpperCase()
          ].filter(Boolean)) || []
        );
      }

      const { data: cargas, error } = await supabase
        .from('cargas_historico')
        .select('data_carga, total_integrantes, dados_snapshot, tipo_carga')
        .eq('tipo_carga', 'integrantes')
        .order('data_carga', { ascending: true });

      if (error) {
        throw error;
      }

      if (!cargas || cargas.length === 0) {
        return null;
      }

      // Filtrar apenas a última carga de cada mês
      const cargasPorMes = new Map<string, typeof cargas[0]>();

      cargas.forEach(carga => {
        const mesAno = format(new Date(carga.data_carga), 'yyyy-MM');
        
        // Se não existe carga para este mês OU a atual é mais recente
        if (!cargasPorMes.has(mesAno) || 
            new Date(carga.data_carga) > new Date(cargasPorMes.get(mesAno)!.data_carga)) {
          cargasPorMes.set(mesAno, carga);
        }
      });

      // Converter Map para array e ordenar por data
      const cargasFiltradas = Array.from(cargasPorMes.values())
        .sort((a, b) => new Date(a.data_carga).getTime() - new Date(b.data_carga).getTime());

      // Processar dados filtrados
      const cargasProcessadas: CargaHistorica[] = cargasFiltradas.map((carga) => {
        const snapshot = carga.dados_snapshot as { divisoes?: DivisaoSnapshot[] };
        let divisoes = snapshot?.divisoes || [];
        
        // Se temos filtro de regional, filtrar apenas divisões dessa regional
        if (divisoesRegionalSet && divisoesRegionalSet.size > 0) {
          divisoes = divisoes.filter(d => {
            const nomeUpper = d.divisao?.toUpperCase();
            const nomeNormalizado = normalizarNomeDivisao(d.divisao)?.toUpperCase();
            return divisoesRegionalSet!.has(nomeUpper) || divisoesRegionalSet!.has(nomeNormalizado);
          });
        }

        // Recalcular total apenas com divisões filtradas
        const totalFiltrado = divisoes.reduce((sum, d) => sum + (d.total || 0), 0);
        
        return {
          data_carga: carga.data_carga,
          total_integrantes: divisoesRegionalSet ? totalFiltrado : carga.total_integrantes,
          divisoes
        };
      });

      // Extrair todas as divisões únicas (já filtradas se regionalId foi fornecido)
      const divisoesSet = new Set<string>();
      cargasProcessadas.forEach(carga => {
        if (carga.divisoes && Array.isArray(carga.divisoes)) {
          carga.divisoes.forEach(divisao => {
            if (divisao && divisao.divisao) {
              const nomeNormalizado = normalizarNomeDivisao(divisao.divisao);
              divisoesSet.add(nomeNormalizado);
            }
          });
        }
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
