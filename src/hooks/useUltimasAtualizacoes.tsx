import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UltimaAtualizacao {
  tipo: 'integrantes' | 'inadimplencia' | 'aniversariantes';
  label: string;
  ultimaAtualizacao: string | null;
  diasDesdeAtualizacao: number | null;
  desatualizado: boolean; // > 7 dias
}

export const useUltimasAtualizacoes = (enabled = true) => {
  return useQuery({
    queryKey: ['ultimas-atualizacoes-gestao'],
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    queryFn: async (): Promise<UltimaAtualizacao[]> => {
      const agora = new Date();
      const LIMITE_DIAS = 7;

      // 1. Integrantes - cargas_historico
      const { data: cargaIntegrantes } = await supabase
        .from('cargas_historico')
        .select('data_carga')
        .eq('tipo_carga', 'integrantes')
        .order('data_carga', { ascending: false })
        .limit(1);

      const dataIntegrantes = cargaIntegrantes?.[0]?.data_carga || null;

      // 2. Inadimplência - mensalidades_atraso
      const { data: cargaMensalidades } = await supabase
        .from('mensalidades_atraso')
        .select('data_carga')
        .eq('ativo', true)
        .order('data_carga', { ascending: false })
        .limit(1);

      const dataMensalidades = cargaMensalidades?.[0]?.data_carga || null;

      // 3. Aniversariantes - usar updated_at dos integrantes que têm data_nascimento
      const { data: ultimoAniversariante } = await supabase
        .from('integrantes_portal')
        .select('updated_at')
        .not('data_nascimento', 'is', null)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      const dataAniversariantes = ultimoAniversariante?.[0]?.updated_at || null;

      const calcularDias = (dataStr: string | null): number | null => {
        if (!dataStr) return null;
        const data = new Date(dataStr);
        return Math.floor((agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));
      };

      const diasIntegrantes = calcularDias(dataIntegrantes);
      const diasMensalidades = calcularDias(dataMensalidades);
      const diasAniversariantes = calcularDias(dataAniversariantes);

      return [
        {
          tipo: 'integrantes',
          label: 'Integrantes',
          ultimaAtualizacao: dataIntegrantes,
          diasDesdeAtualizacao: diasIntegrantes,
          desatualizado: diasIntegrantes !== null ? diasIntegrantes > LIMITE_DIAS : true,
        },
        {
          tipo: 'inadimplencia',
          label: 'Inadimplência',
          ultimaAtualizacao: dataMensalidades,
          diasDesdeAtualizacao: diasMensalidades,
          desatualizado: diasMensalidades !== null ? diasMensalidades > LIMITE_DIAS : true,
        },
        {
          tipo: 'aniversariantes',
          label: 'Aniversários',
          ultimaAtualizacao: dataAniversariantes,
          diasDesdeAtualizacao: diasAniversariantes,
          desatualizado: diasAniversariantes !== null ? diasAniversariantes > LIMITE_DIAS : true,
        },
      ];
    },
  });
};
