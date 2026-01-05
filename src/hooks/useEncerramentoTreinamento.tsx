import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TreinamentoEncerramento {
  id: string; // solicitacao_id
  status: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_cargo_atual: string;
  cargo_treinamento_id: string;
  cargo_treinamento_nome: string;
  data_inicio_treinamento: string | null;
  tempo_treinamento_meses: number;
  data_termino_previsto: string | null;
}

interface EncerrarParams {
  solicitacaoId: string;
  integranteId: string;
  cargoTreinamentoId: string;
  tipoEncerramento: string;
  observacoes: string;
  encerradoPor: {
    id: string | null;
    nome: string;
    cargo: string | null;
    divisao: string | null;
  };
}

interface CancelarParams {
  solicitacaoId: string;
  integranteId: string;
  justificativa: string;
  canceladoPor: {
    id: string | null;
    nome: string;
    cargo: string | null;
    divisao: string | null;
  };
}

export function useEncerramentoTreinamento(userId: string | undefined) {
  const [treinamentos, setTreinamentos] = useState<TreinamentoEncerramento[]>([]);
  const [loading, setLoading] = useState(true);
  const [operando, setOperando] = useState(false);
  const [meuIntegranteId, setMeuIntegranteId] = useState<string | null>(null);

  // Buscar meu integrante_id
  useEffect(() => {
    async function fetchMeuIntegrante() {
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_colete')
        .eq('id', userId)
        .single();
      
      if (profile?.nome_colete) {
        const { data: integrante } = await supabase
          .from('integrantes_portal')
          .select('id')
          .eq('nome_colete', profile.nome_colete)
          .eq('ativo', true)
          .single();
        
        if (integrante) {
          setMeuIntegranteId(integrante.id);
        }
      }
    }
    
    fetchMeuIntegrante();
  }, [userId]);

  const fetchTreinamentos = useCallback(async () => {
    if (!meuIntegranteId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Buscar solicitações onde sou aprovador
      const { data: minhasAprovacoes, error: apError } = await supabase
        .from('aprovacoes_treinamento')
        .select('solicitacao_id')
        .eq('aprovador_integrante_id', meuIntegranteId);

      if (apError) {
        console.error('Erro ao buscar aprovações:', apError);
        setLoading(false);
        return;
      }

      if (!minhasAprovacoes || minhasAprovacoes.length === 0) {
        setTreinamentos([]);
        setLoading(false);
        return;
      }

      const solicitacaoIds = minhasAprovacoes.map(a => a.solicitacao_id);

      // 2. Buscar solicitações com status ativo
      const { data: solicitacoes, error: solError } = await supabase
        .from('solicitacoes_treinamento')
        .select(`
          id,
          status,
          integrante_id,
          cargo_treinamento_id,
          data_inicio_treinamento,
          tempo_treinamento_meses,
          data_termino_previsto,
          integrante:integrantes_portal!solicitacoes_treinamento_integrante_id_fkey(
            nome_colete,
            divisao_texto,
            regional_texto,
            cargo_grau_texto
          ),
          cargo_treinamento:cargos!solicitacoes_treinamento_cargo_treinamento_id_fkey(
            nome
          )
        `)
        .in('id', solicitacaoIds)
        .in('status', ['Em Aprovacao', 'Em Treinamento']);

      if (solError) {
        console.error('Erro ao buscar solicitações:', solError);
        setLoading(false);
        return;
      }

      const mapped: TreinamentoEncerramento[] = (solicitacoes || []).map(s => {
        const integrante = s.integrante as { nome_colete: string; divisao_texto: string; regional_texto: string; cargo_grau_texto: string } | null;
        const cargo = s.cargo_treinamento as { nome: string } | null;
        
        return {
          id: s.id,
          status: s.status || '',
          integrante_id: s.integrante_id,
          integrante_nome_colete: integrante?.nome_colete || '',
          integrante_divisao_texto: integrante?.divisao_texto || '',
          integrante_regional_texto: integrante?.regional_texto || '',
          integrante_cargo_atual: integrante?.cargo_grau_texto || '',
          cargo_treinamento_id: s.cargo_treinamento_id,
          cargo_treinamento_nome: cargo?.nome || '',
          data_inicio_treinamento: s.data_inicio_treinamento,
          tempo_treinamento_meses: s.tempo_treinamento_meses || 3,
          data_termino_previsto: s.data_termino_previsto
        };
      });

      setTreinamentos(mapped);
    } catch (error) {
      console.error('Erro ao buscar treinamentos:', error);
    } finally {
      setLoading(false);
    }
  }, [meuIntegranteId]);

  useEffect(() => {
    fetchTreinamentos();
  }, [fetchTreinamentos]);

  async function cancelarSolicitacao(params: CancelarParams): Promise<boolean> {
    setOperando(true);
    
    try {
      // 1. Atualizar status da solicitação
      const { error: statusError } = await supabase
        .from('solicitacoes_treinamento')
        .update({ status: 'Cancelado' })
        .eq('id', params.solicitacaoId);
      
      if (statusError) {
        console.error('Erro ao cancelar solicitação:', statusError);
        toast({
          title: 'Erro',
          description: 'Não foi possível cancelar a solicitação.',
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
      }

      // 3. Registrar no histórico
      const { error: histError } = await supabase
        .from('treinamentos_historico')
        .insert({
          integrante_id: params.integranteId,
          cargo_treinamento_id: null,
          tipo_encerramento: 'Cancelado',
          observacoes: params.justificativa,
          encerrado_por: params.canceladoPor.id,
          encerrado_por_nome_colete: params.canceladoPor.nome,
          encerrado_por_cargo: params.canceladoPor.cargo,
          encerrado_por_divisao: params.canceladoPor.divisao,
          data_encerramento: new Date().toISOString()
        });
      
      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
      }

      toast({
        title: 'Solicitação Cancelada',
        description: 'A solicitação de treinamento foi cancelada com sucesso.',
      });

      await fetchTreinamentos();
      return true;
    } finally {
      setOperando(false);
    }
  }

  async function encerrarTreinamento(params: EncerrarParams): Promise<boolean> {
    setOperando(true);
    
    try {
      // 1. Atualizar status da solicitação
      const { error: statusError } = await supabase
        .from('solicitacoes_treinamento')
        .update({ status: params.tipoEncerramento })
        .eq('id', params.solicitacaoId);
      
      if (statusError) {
        console.error('Erro ao encerrar treinamento:', statusError);
        toast({
          title: 'Erro',
          description: 'Não foi possível encerrar o treinamento.',
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
      }

      // 3. Registrar no histórico
      const { error: histError } = await supabase
        .from('treinamentos_historico')
        .insert({
          integrante_id: params.integranteId,
          cargo_treinamento_id: params.cargoTreinamentoId,
          tipo_encerramento: params.tipoEncerramento,
          observacoes: params.observacoes || null,
          encerrado_por: params.encerradoPor.id,
          encerrado_por_nome_colete: params.encerradoPor.nome,
          encerrado_por_cargo: params.encerradoPor.cargo,
          encerrado_por_divisao: params.encerradoPor.divisao,
          data_encerramento: new Date().toISOString()
        });
      
      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
      }

      toast({
        title: 'Treinamento Encerrado',
        description: 'O treinamento foi encerrado com sucesso.',
      });

      await fetchTreinamentos();
      return true;
    } finally {
      setOperando(false);
    }
  }

  return {
    treinamentos,
    loading,
    operando,
    cancelarSolicitacao,
    encerrarTreinamento,
    refetch: fetchTreinamentos
  };
}
