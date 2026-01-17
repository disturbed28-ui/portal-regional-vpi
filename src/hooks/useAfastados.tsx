import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IntegranteAfastado {
  id: string;
  registro_id: number;
  nome_colete: string;
  divisao_id: string | null;
  divisao_texto: string;
  cargo_grau_texto: string | null;
  tipo_afastamento: string;
  data_afastamento: string;
  data_retorno_prevista: string;
  data_retorno_efetivo: string | null;
  ativo: boolean;
  observacoes: string | null;
  carga_historico_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AfastadosFiltros {
  divisaoId?: string;        // Para Grau VI+ (filtra por divisão específica)
  divisaoIds?: string[];     // Para Grau V (filtra por divisões da regional)
}

export const useAfastadosAtivos = (filtros?: AfastadosFiltros) => {
  const [afastados, setAfastados] = useState<IntegranteAfastado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAfastados();

    const channel = supabase
      .channel('afastados-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrantes_afastados',
        },
        () => {
          fetchAfastados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtros?.divisaoId, filtros?.divisaoIds?.join(',')]);

  const fetchAfastados = async () => {
    setLoading(true);
    
    let query = supabase
      .from('integrantes_afastados')
      .select('*')
      .eq('ativo', true);

    // Filtro por divisão específica (Grau VI+)
    if (filtros?.divisaoId) {
      query = query.eq('divisao_id', filtros.divisaoId);
    }
    // Filtro por lista de divisões (Grau V - regional)
    else if (filtros?.divisaoIds && filtros.divisaoIds.length > 0) {
      query = query.in('divisao_id', filtros.divisaoIds);
    }
    // Sem filtro = comando (vê tudo)

    const { data, error } = await query.order('data_retorno_prevista');

    if (error) {
      console.error('Error fetching afastados ativos:', error);
    } else {
      setAfastados(data || []);
    }
    setLoading(false);
  };

  return { afastados, loading, refetch: fetchAfastados };
};

export const useAfastadosHistorico = (filtros?: AfastadosFiltros) => {
  const [afastados, setAfastados] = useState<IntegranteAfastado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAfastados();
  }, [filtros?.divisaoId, filtros?.divisaoIds?.join(',')]);

  const fetchAfastados = async () => {
    setLoading(true);
    
    let query = supabase
      .from('integrantes_afastados')
      .select('*');

    // Filtro por divisão específica (Grau VI+)
    if (filtros?.divisaoId) {
      query = query.eq('divisao_id', filtros.divisaoId);
    }
    // Filtro por lista de divisões (Grau V - regional)
    else if (filtros?.divisaoIds && filtros.divisaoIds.length > 0) {
      query = query.in('divisao_id', filtros.divisaoIds);
    }
    // Sem filtro = comando (vê tudo)

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching afastados histórico:', error);
    } else {
      setAfastados(data || []);
    }
    setLoading(false);
  };

  return { afastados, loading, refetch: fetchAfastados };
};

export const useRetornosProximos = (dias: number = 30, filtros?: AfastadosFiltros) => {
  const [afastados, setAfastados] = useState<IntegranteAfastado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRetornos();
  }, [dias, filtros?.divisaoId, filtros?.divisaoIds?.join(',')]);

  const fetchRetornos = async () => {
    setLoading(true);
    
    const hoje = new Date().toISOString().split('T')[0];
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + dias);
    const dataFuturaISO = dataFutura.toISOString().split('T')[0];

    let query = supabase
      .from('integrantes_afastados')
      .select('*')
      .eq('ativo', true)
      .gte('data_retorno_prevista', hoje)
      .lte('data_retorno_prevista', dataFuturaISO);

    // Filtro por divisão específica (Grau VI+)
    if (filtros?.divisaoId) {
      query = query.eq('divisao_id', filtros.divisaoId);
    }
    // Filtro por lista de divisões (Grau V - regional)
    else if (filtros?.divisaoIds && filtros.divisaoIds.length > 0) {
      query = query.in('divisao_id', filtros.divisaoIds);
    }
    // Sem filtro = comando (vê tudo)

    const { data, error } = await query.order('data_retorno_prevista');

    if (error) {
      console.error('Error fetching retornos próximos:', error);
    } else {
      setAfastados(data || []);
    }
    setLoading(false);
  };

  return { afastados, loading, refetch: fetchRetornos };
};

export type MotivoBaixa = 'retornou' | 'desligamento' | 'outro';

export interface DadosBaixa {
  motivo: MotivoBaixa;
  observacoes?: string;
}

export const useRegistrarRetorno = () => {
  const registrarRetorno = async (afastadoId: string, dadosBaixa?: DadosBaixa) => {
    const hoje = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('integrantes_afastados')
      .update({
        data_retorno_efetivo: hoje,
        ativo: false,
        motivo_baixa: dadosBaixa?.motivo || 'retornou',
        observacoes_baixa: dadosBaixa?.observacoes || null,
      })
      .eq('id', afastadoId);

    if (error) {
      console.error('Error registrando retorno:', error);
      throw error;
    }

    return { success: true };
  };

  return { registrarRetorno };
};
