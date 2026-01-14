import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EstagioEncerramento {
  id: string; // solicitacao_id
  status: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_cargo_atual: string;
  cargo_estagio_id: string;
  cargo_estagio_nome: string;
  grau_estagio: string;
  data_inicio_estagio: string | null;
  tempo_estagio_meses: number;
  data_termino_previsto: string | null;
}

interface EncerrarParams {
  solicitacaoId: string;
  integranteId: string;
  cargoEstagioId: string;
  grauEstagio: string;
  tipoEncerramento: string;
  observacoes: string;
  encerradoPor: {
    id: string | null;
    nome: string;
    cargo: string | null;
    divisao: string | null;
  };
  divisaoId?: string | null;
  regionalId?: string | null;
  dataInicio?: string | null;
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

export function useEncerramentoEstagio(userId: string | undefined) {
  const [estagios, setEstagios] = useState<EstagioEncerramento[]>([]);
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

  const fetchEstagios = useCallback(async () => {
    if (!meuIntegranteId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Buscar solicitações onde sou aprovador
      const { data: minhasAprovacoes, error: apError } = await supabase
        .from('aprovacoes_estagio')
        .select('solicitacao_id')
        .eq('aprovador_integrante_id', meuIntegranteId);

      if (apError) {
        console.error('Erro ao buscar aprovações:', apError);
        setLoading(false);
        return;
      }

      if (!minhasAprovacoes || minhasAprovacoes.length === 0) {
        setEstagios([]);
        setLoading(false);
        return;
      }

      const solicitacaoIds = minhasAprovacoes.map(a => a.solicitacao_id);

      // 2. Buscar solicitações com status ativo
      const { data: solicitacoes, error: solError } = await supabase
        .from('solicitacoes_estagio')
        .select(`
          id,
          status,
          integrante_id,
          cargo_estagio_id,
          grau_estagio,
          data_inicio_estagio,
          tempo_estagio_meses,
          data_termino_previsto,
          divisao_id,
          regional_id,
          integrante:integrantes_portal!solicitacoes_estagio_integrante_id_fkey(
            nome_colete,
            divisao_texto,
            regional_texto,
            cargo_grau_texto
          ),
          cargo_estagio:cargos!solicitacoes_estagio_cargo_estagio_id_fkey(
            nome
          )
        `)
        .in('id', solicitacaoIds)
        .in('status', ['Em Aprovacao', 'Em Estagio']);

      if (solError) {
        console.error('Erro ao buscar solicitações:', solError);
        setLoading(false);
        return;
      }

      const mapped: EstagioEncerramento[] = (solicitacoes || []).map(s => {
        const integrante = s.integrante as { nome_colete: string; divisao_texto: string; regional_texto: string; cargo_grau_texto: string } | null;
        const cargo = s.cargo_estagio as { nome: string } | null;
        
        return {
          id: s.id,
          status: s.status || '',
          integrante_id: s.integrante_id,
          integrante_nome_colete: integrante?.nome_colete || '',
          integrante_divisao_texto: integrante?.divisao_texto || '',
          integrante_regional_texto: integrante?.regional_texto || '',
          integrante_cargo_atual: integrante?.cargo_grau_texto || '',
          cargo_estagio_id: s.cargo_estagio_id,
          cargo_estagio_nome: cargo?.nome || '',
          grau_estagio: s.grau_estagio || '',
          data_inicio_estagio: s.data_inicio_estagio,
          tempo_estagio_meses: s.tempo_estagio_meses || 6,
          data_termino_previsto: s.data_termino_previsto
        };
      });

      setEstagios(mapped);
    } catch (error) {
      console.error('Erro ao buscar estágios:', error);
    } finally {
      setLoading(false);
    }
  }, [meuIntegranteId]);

  useEffect(() => {
    fetchEstagios();
  }, [fetchEstagios]);

  async function cancelarSolicitacao(params: CancelarParams): Promise<boolean> {
    setOperando(true);
    
    try {
      // 1. Atualizar status da solicitação
      const { error: statusError } = await supabase
        .from('solicitacoes_estagio')
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

      // 2. Limpar cargo_estagio_id do integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_estagio_id: null })
        .eq('id', params.integranteId);
      
      if (updateError) {
        console.error('Erro ao limpar estágio:', updateError);
      }

      // 3. Registrar no histórico
      const { error: histError } = await supabase
        .from('estagios_historico')
        .insert({
          integrante_id: params.integranteId,
          cargo_estagio_id: null,
          grau_estagio: 'N/A',
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
        description: 'A solicitação de estágio foi cancelada com sucesso.',
      });

      await fetchEstagios();
      return true;
    } finally {
      setOperando(false);
    }
  }

  async function encerrarEstagio(params: EncerrarParams): Promise<boolean> {
    setOperando(true);
    
    try {
      // 1. Atualizar status da solicitação
      const { error: statusError } = await supabase
        .from('solicitacoes_estagio')
        .update({ status: params.tipoEncerramento })
        .eq('id', params.solicitacaoId);
      
      if (statusError) {
        console.error('Erro ao encerrar estágio:', statusError);
        toast({
          title: 'Erro',
          description: 'Não foi possível encerrar o estágio.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Limpar cargo_estagio_id do integrante
      const { error: updateError } = await supabase
        .from('integrantes_portal')
        .update({ cargo_estagio_id: null })
        .eq('id', params.integranteId);
      
      if (updateError) {
        console.error('Erro ao limpar estágio:', updateError);
      }

      // 3. Registrar no histórico
      const { error: histError } = await supabase
        .from('estagios_historico')
        .insert({
          integrante_id: params.integranteId,
          cargo_estagio_id: params.cargoEstagioId,
          grau_estagio: params.grauEstagio,
          tipo_encerramento: params.tipoEncerramento,
          observacoes: params.observacoes || null,
          encerrado_por: params.encerradoPor.id,
          encerrado_por_nome_colete: params.encerradoPor.nome,
          encerrado_por_cargo: params.encerradoPor.cargo,
          encerrado_por_divisao: params.encerradoPor.divisao,
          data_inicio: params.dataInicio || null,
          data_encerramento: new Date().toISOString(),
          solicitacao_id: params.solicitacaoId,
          divisao_id: params.divisaoId || null,
          regional_id: params.regionalId || null
        });
      
      if (histError) {
        console.error('Erro ao registrar histórico:', histError);
      }

      toast({
        title: 'Estágio Encerrado',
        description: 'O estágio foi encerrado com sucesso.',
      });

      await fetchEstagios();
      return true;
    } finally {
      setOperando(false);
    }
  }

  return {
    estagios,
    loading,
    operando,
    cancelarSolicitacao,
    encerrarEstagio,
    refetch: fetchEstagios
  };
}
