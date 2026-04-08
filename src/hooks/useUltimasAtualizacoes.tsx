import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UltimaAtualizacao {
  tipo: 'integrantes' | 'inadimplencia' | 'aniversariantes' | 'afastados';
  label: string;
  ultimaAtualizacao: string | null;
  diasDesdeAtualizacao: number | null;
  desatualizado: boolean; // > 7 dias
  dispensado: boolean; // dispensado manualmente
}

export const useUltimasAtualizacoes = (enabled = true) => {
  return useQuery({
    queryKey: ['ultimas-atualizacoes-gestao'],
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    queryFn: async (): Promise<UltimaAtualizacao[]> => {
      const agora = new Date();
      const LIMITE_DIAS = 7;

      // Buscar dispensas ativas
      const { data: dispensasAtivas } = await supabase
        .from('dados_atualizacao_dispensa')
        .select('tipo_dado')
        .gte('valido_ate', new Date().toISOString());
      
      const tiposDispensados = new Set(dispensasAtivas?.map(d => d.tipo_dado) || []);

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

      // 4. Afastados - cargas_historico tipo 'afastados'
      const { data: cargaAfastados } = await supabase
        .from('cargas_historico')
        .select('data_carga')
        .eq('tipo_carga', 'afastados')
        .order('data_carga', { ascending: false })
        .limit(1);

      const dataAfastados = cargaAfastados?.[0]?.data_carga || null;

      const calcularDias = (dataStr: string | null): number | null => {
        if (!dataStr) return null;
        const data = new Date(dataStr);
        return Math.floor((agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));
      };

      const diasIntegrantes = calcularDias(dataIntegrantes);
      const diasMensalidades = calcularDias(dataMensalidades);
      const diasAniversariantes = calcularDias(dataAniversariantes);
      const diasAfastados = calcularDias(dataAfastados);

      return [
        {
          tipo: 'integrantes',
          label: 'Integrantes',
          ultimaAtualizacao: dataIntegrantes,
          diasDesdeAtualizacao: diasIntegrantes,
          desatualizado: (diasIntegrantes !== null ? diasIntegrantes > LIMITE_DIAS : true) && !tiposDispensados.has('integrantes'),
          dispensado: tiposDispensados.has('integrantes'),
        },
        {
          tipo: 'inadimplencia',
          label: 'Inadimplência',
          ultimaAtualizacao: dataMensalidades,
          diasDesdeAtualizacao: diasMensalidades,
          desatualizado: (diasMensalidades !== null ? diasMensalidades > LIMITE_DIAS : true) && !tiposDispensados.has('inadimplencia'),
          dispensado: tiposDispensados.has('inadimplencia'),
        },
        {
          tipo: 'aniversariantes',
          label: 'Aniversários',
          ultimaAtualizacao: dataAniversariantes,
          diasDesdeAtualizacao: diasAniversariantes,
          desatualizado: (diasAniversariantes !== null ? diasAniversariantes > LIMITE_DIAS : true) && !tiposDispensados.has('aniversariantes'),
          dispensado: tiposDispensados.has('aniversariantes'),
        },
        {
          tipo: 'afastados',
          label: 'Afastados',
          ultimaAtualizacao: dataAfastados,
          diasDesdeAtualizacao: diasAfastados,
          desatualizado: (diasAfastados !== null ? diasAfastados > LIMITE_DIAS : true) && !tiposDispensados.has('afastados'),
          dispensado: tiposDispensados.has('afastados'),
        },
      ];
    },
  });
};
