import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CampoAlterado {
  campo: string;
  label: string;
  anterior: string;
  novo: string;
}

export interface IntegranteAtualizado {
  registro_id: number;
  nome_colete: string;
  integrante_id: string;
  alteracoes: CampoAlterado[];
}

export const useAtualizacoesCarga = (cargaId?: string) => {
  return useQuery({
    queryKey: ['atualizacoes-carga', cargaId],
    enabled: !!cargaId,
    queryFn: async (): Promise<IntegranteAtualizado[]> => {
      const { data, error } = await supabase
        .from('atualizacoes_carga')
        .select('*')
        .eq('carga_historico_id', cargaId)
        .order('nome_colete');
      
      if (error) {
        throw error;
      }
      
      // Agrupar por integrante
      const grouped = (data || []).reduce((acc, item) => {
        const key = item.registro_id;
        if (!acc[key]) {
          acc[key] = {
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            integrante_id: item.integrante_id,
            alteracoes: []
          };
        }
        acc[key].alteracoes.push({
          campo: item.campo_alterado,
          label: getLabelCampo(item.campo_alterado),
          anterior: item.valor_anterior || '-',
          novo: item.valor_novo || '-'
        });
        return acc;
      }, {} as Record<number, IntegranteAtualizado>);
      
      return Object.values(grouped);
    }
  });
};

// Função auxiliar para labels amigáveis
const getLabelCampo = (campo: string): string => {
  const labels: Record<string, string> = {
    nome_colete: 'Nome Colete',
    comando_texto: 'Comando',
    regional_texto: 'Regional',
    divisao_texto: 'Divisão',
    cargo_grau_texto: 'Cargo/Grau',
    cargo_estagio: 'Estágio',
    tem_moto: 'Tem Moto',
    tem_carro: 'Tem Carro',
    sgt_armas: 'Sgt Armas',
    caveira: 'Caveira',
    caveira_suplente: 'Caveira Suplente',
    batedor: 'Batedor',
    ursinho: 'Ursinho',
    lobo: 'Lobo',
    combate_insano: 'Combate Insano',
    data_entrada: 'Data Entrada',
  };
  return labels[campo] || campo;
};
