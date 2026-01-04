import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface IntegranteTreinamento {
  id: string;
  nome_colete: string;
  cargo_grau_texto: string;
  divisao_texto: string;
  divisao_id: string | null;
  regional_id: string | null;
  cargo_treinamento_id: string | null;
}

interface SolicitanteData {
  integrante_id: string | null;
  nome_colete: string;
  cargo_id: string | null;
  divisao_id: string | null;
}

interface CreateSolicitacaoParams {
  integrante: IntegranteTreinamento;
  cargoTreinamentoId: string;
  solicitante: SolicitanteData;
}

interface EncerrarTreinamentoParams {
  integranteId: string;
  cargoTreinamentoId: string;
  tipoEncerramento: string;
  observacoes: string;
  encerradoPorId: string | null;
  encerradoPorNome: string;
}

export function useSolicitacaoTreinamento() {
  const [loading, setLoading] = useState(false);

  async function verificarTreinamentoAtivo(integranteId: string): Promise<{
    emTreinamento: boolean;
    cargoTreinamentoId: string | null;
    cargoTreinamentoNome: string | null;
  }> {
    const { data, error } = await supabase
      .from('integrantes_portal')
      .select(`
        cargo_treinamento_id,
        cargo_treinamento:cargos!integrantes_portal_cargo_treinamento_id_fkey(nome)
      `)
      .eq('id', integranteId)
      .single();
    
    if (error) {
      console.error('Erro ao verificar treinamento ativo:', error);
      return { emTreinamento: false, cargoTreinamentoId: null, cargoTreinamentoNome: null };
    }

    const cargoTreinamento = data?.cargo_treinamento as { nome: string } | null;

    return {
      emTreinamento: !!data?.cargo_treinamento_id,
      cargoTreinamentoId: data?.cargo_treinamento_id || null,
      cargoTreinamentoNome: cargoTreinamento?.nome || null
    };
  }

  async function encerrarTreinamento(params: EncerrarTreinamentoParams): Promise<boolean> {
    setLoading(true);
    
    try {
      // 1. Registrar no histórico
      const { error: histError } = await supabase
        .from('treinamentos_historico')
        .insert({
          integrante_id: params.integranteId,
          cargo_treinamento_id: params.cargoTreinamentoId,
          tipo_encerramento: params.tipoEncerramento,
          observacoes: params.observacoes,
          encerrado_por: params.encerradoPorId,
          encerrado_por_nome_colete: params.encerradoPorNome,
          data_encerramento: new Date().toISOString()
        });
      
      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
        toast({
          title: 'Erro',
          description: 'Não foi possível registrar o encerramento do treinamento.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Limpar cargo_treinamento_id do integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_treinamento_id: null })
        .eq('id', params.integranteId);
      
      if (updateError) {
        console.error('Erro ao limpar treinamento:', updateError);
        toast({
          title: 'Erro',
          description: 'Não foi possível limpar o treinamento anterior.',
          variant: 'destructive'
        });
        return false;
      }

      return true;
    } finally {
      setLoading(false);
    }
  }

  async function createSolicitacao(params: CreateSolicitacaoParams): Promise<boolean> {
    setLoading(true);
    
    try {
      // Buscar cargo_id atual do integrante baseado no cargo_grau_texto
      const { data: cargoAtual } = await supabase
        .from('cargos')
        .select('id')
        .ilike('nome', `%${params.integrante.cargo_grau_texto.split(' ')[0]}%`)
        .limit(1)
        .single();

      // 1. Criar solicitação
      const { error: solError } = await supabase
        .from('solicitacoes_treinamento')
        .insert({
          integrante_id: params.integrante.id,
          divisao_id: params.integrante.divisao_id,
          regional_id: params.integrante.regional_id,
          cargo_atual_id: cargoAtual?.id || null,
          cargo_treinamento_id: params.cargoTreinamentoId,
          solicitante_integrante_id: params.solicitante.integrante_id,
          solicitante_nome_colete: params.solicitante.nome_colete,
          solicitante_cargo_id: params.solicitante.cargo_id,
          solicitante_divisao_id: params.solicitante.divisao_id,
          status: 'Em Aprovacao'
        });
      
      if (solError) {
        console.error('Erro ao criar solicitação:', solError);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar a solicitação de treinamento.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Atualizar cargo_treinamento_id do integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_treinamento_id: params.cargoTreinamentoId })
        .eq('id', params.integrante.id);
      
      if (updateError) {
        console.error('Erro ao atualizar treinamento:', updateError);
        toast({
          title: 'Erro',
          description: 'Solicitação criada, mas não foi possível marcar o integrante em treinamento.',
          variant: 'destructive'
        });
        return false;
      }

      toast({
        title: 'Solicitação Enviada',
        description: 'A solicitação de treinamento foi criada com sucesso.',
      });

      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    verificarTreinamentoAtivo,
    encerrarTreinamento,
    createSolicitacao
  };
}
