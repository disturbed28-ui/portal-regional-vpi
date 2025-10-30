import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMensalidades = () => {
  // Buscar resumo da última carga ativa
  const { data: ultimaCargaInfo } = useQuery({
    queryKey: ['mensalidades-ultima-carga-info'],
    queryFn: async () => {
      const { data: mensalidades } = await supabase
        .from('mensalidades_atraso')
        .select('data_carga, ref')
        .eq('ativo', true)
        .order('data_carga', { ascending: false })
        .limit(1);

      if (!mensalidades || mensalidades.length === 0) return null;

      return {
        data_carga: mensalidades[0].data_carga,
        ref_principal: mensalidades[0].ref,
      };
    }
  });

  // Buscar devedores ativos (view)
  const { data: devedoresAtivos = [] } = useQuery({
    queryKey: ['mensalidades-devedores-ativos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vw_devedores_ativos')
        .select('*')
        .order('total_devido', { ascending: false });
      return data || [];
    }
  });

  // Buscar devedores crônicos (view)
  const { data: devedoresCronicos = [] } = useQuery({
    queryKey: ['mensalidades-devedores-cronicos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vw_devedores_cronicos')
        .select('*')
        .order('total_meses_historico', { ascending: false });
      return data || [];
    }
  });

  return {
    ultimaCargaInfo,
    devedoresAtivos,
    devedoresCronicos,
  };
};
