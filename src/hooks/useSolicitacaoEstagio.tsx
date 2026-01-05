import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addMonths } from 'date-fns';

interface IntegranteEstagio {
  id: string;
  nome_colete: string;
  cargo_grau_texto: string;
  divisao_texto: string;
  divisao_id: string | null;
  regional_id: string | null;
  cargo_estagio_id: string | null;
}

interface SolicitanteData {
  integrante_id: string | null;
  nome_colete: string;
  cargo_id: string | null;
  divisao_id: string | null;
}

interface CreateSolicitacaoEstagioParams {
  integrante: IntegranteEstagio;
  cargoEstagioId: string;
  grauEstagio: 'V' | 'VI';
  solicitante: SolicitanteData;
  dataInicioEstagio: Date;
  tempoEstagioMeses: number;
}

interface EncerrarEstagioParams {
  integranteId: string;
  cargoEstagioId: string;
  tipoEncerramento: string;
  observacoes: string;
  encerradoPorId: string | null;
  encerradoPorNome: string;
}

export function useSolicitacaoEstagio() {
  const [loading, setLoading] = useState(false);

  async function verificarEstagioAtivo(integranteId: string): Promise<{
    emEstagio: boolean;
    cargoEstagioId: string | null;
    cargoEstagioNome: string | null;
    grauEstagio: string | null;
  }> {
    const { data, error } = await supabase
      .from('integrantes_portal')
      .select(`
        cargo_estagio_id,
        cargo_estagio:cargos!integrantes_portal_cargo_estagio_id_fkey(nome, grau)
      `)
      .eq('id', integranteId)
      .single();
    
    if (error) {
      console.error('Erro ao verificar estágio ativo:', error);
      return { emEstagio: false, cargoEstagioId: null, cargoEstagioNome: null, grauEstagio: null };
    }

    const cargoEstagio = data?.cargo_estagio as { nome: string; grau: string } | null;

    return {
      emEstagio: !!data?.cargo_estagio_id,
      cargoEstagioId: data?.cargo_estagio_id || null,
      cargoEstagioNome: cargoEstagio?.nome || null,
      grauEstagio: cargoEstagio?.grau || null
    };
  }

  async function encerrarEstagio(params: EncerrarEstagioParams): Promise<boolean> {
    setLoading(true);
    
    try {
      // Limpar cargo_estagio_id do integrante
      // Histórico de estágio será implementado posteriormente
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_estagio_id: null })
        .eq('id', params.integranteId);
      
      if (updateError) {
        console.error('Erro ao limpar estágio:', updateError);
        toast({
          title: 'Erro',
          description: 'Não foi possível limpar o estágio anterior.',
          variant: 'destructive'
        });
        return false;
      }

      return true;
    } finally {
      setLoading(false);
    }
  }

  async function createSolicitacao(params: CreateSolicitacaoEstagioParams): Promise<boolean> {
    setLoading(true);
    
    try {
      // Buscar cargo_id atual do integrante baseado no cargo_grau_texto
      const { data: cargoAtual } = await supabase
        .from('cargos')
        .select('id')
        .ilike('nome', `%${params.integrante.cargo_grau_texto.split(' ')[0]}%`)
        .limit(1)
        .single();

      // Calcular data de término previsto
      const dataTerminoPrevisto = addMonths(params.dataInicioEstagio, params.tempoEstagioMeses);

      // 1. Criar solicitação
      const { error: solError } = await supabase
        .from('solicitacoes_estagio')
        .insert({
          integrante_id: params.integrante.id,
          divisao_id: params.integrante.divisao_id,
          regional_id: params.integrante.regional_id,
          cargo_atual_id: cargoAtual?.id || null,
          cargo_estagio_id: params.cargoEstagioId,
          grau_estagio: params.grauEstagio,
          solicitante_integrante_id: params.solicitante.integrante_id,
          solicitante_nome_colete: params.solicitante.nome_colete,
          solicitante_cargo_id: params.solicitante.cargo_id,
          solicitante_divisao_id: params.solicitante.divisao_id,
          status: 'Em Aprovacao',
          data_inicio_estagio: params.dataInicioEstagio.toISOString().split('T')[0],
          tempo_estagio_meses: params.tempoEstagioMeses,
          data_termino_previsto: dataTerminoPrevisto.toISOString().split('T')[0]
        });
      
      if (solError) {
        console.error('Erro ao criar solicitação:', solError);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar a solicitação de estágio.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Atualizar cargo_estagio_id do integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_estagio_id: params.cargoEstagioId })
        .eq('id', params.integrante.id);
      
      if (updateError) {
        console.error('Erro ao atualizar estágio:', updateError);
        toast({
          title: 'Erro',
          description: 'Solicitação criada, mas não foi possível marcar o integrante em estágio.',
          variant: 'destructive'
        });
        return false;
      }

      toast({
        title: 'Solicitação Enviada',
        description: 'A solicitação de estágio foi criada com sucesso.',
      });

      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    verificarEstagioAtivo,
    encerrarEstagio,
    createSolicitacao
  };
}
