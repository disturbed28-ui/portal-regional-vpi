import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AprovacaoEstagio {
  id: string;
  nivel: number;
  tipo_aprovador: string;
  aprovador_integrante_id: string | null;
  aprovador_nome_colete: string | null;
  aprovador_cargo: string | null;
  status: string;
  data_hora_acao: string | null;
  justificativa_rejeicao: string | null;
}

interface SolicitacaoAprovacaoEstagio {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_cargo_atual: string;
  cargo_estagio_nome: string;
  cargo_estagio_id: string;
  grau_estagio: string;
  solicitante_nome_colete: string;
  solicitante_cargo: string | null;
  solicitante_divisao_texto: string | null;
  created_at: string;
  tempo_estagio_meses: number;
  data_termino_previsto: string;
  data_inicio_estagio: string;
  aprovacoes: AprovacaoEstagio[];
  aprovacaoAtual: AprovacaoEstagio | null;
  isAprovadorDaVez: boolean;
}

export function useAprovacoesEstagiosPendentes(userId: string | undefined) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAprovacaoEstagio[]>([]);
  const [loading, setLoading] = useState(true);
  const [operando, setOperando] = useState(false);
  const [meuIntegranteId, setMeuIntegranteId] = useState<string | null>(null);

  // Buscar o integrante_id do usuário logado
  useEffect(() => {
    async function fetchMeuIntegranteId() {
      if (!userId) return;
      
      const { data } = await supabase
        .from('integrantes_portal')
        .select('id')
        .eq('profile_id', userId)
        .single();
      
      if (data?.id) {
        setMeuIntegranteId(data.id);
      }
    }
    fetchMeuIntegranteId();
  }, [userId]);

  const fetchSolicitacoes = useCallback(async () => {
    if (!meuIntegranteId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Buscar solicitações em aprovação
      const { data: solicitacoesData, error: solicitacoesError } = await supabase
        .from('solicitacoes_estagio')
        .select(`
          id,
          integrante_id,
          cargo_estagio_id,
          grau_estagio,
          solicitante_nome_colete,
          tempo_estagio_meses,
          data_termino_previsto,
          data_inicio_estagio,
          created_at,
          integrante:integrantes_portal!solicitacoes_estagio_integrante_id_fkey(
            nome_colete,
            divisao_texto,
            regional_texto,
            cargo_grau_texto
          ),
          cargo_estagio:cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome),
          solicitante_cargo:cargos!solicitacoes_estagio_solicitante_cargo_id_fkey(nome),
          solicitante_divisao:divisoes!solicitacoes_estagio_solicitante_divisao_id_fkey(nome)
        `)
        .eq('status', 'Em Aprovacao')
        .order('created_at', { ascending: true });

      if (solicitacoesError) throw solicitacoesError;

      if (!solicitacoesData || solicitacoesData.length === 0) {
        setSolicitacoes([]);
        setLoading(false);
        return;
      }

      // Buscar aprovações para cada solicitação
      const solicitacaoIds = solicitacoesData.map(s => s.id);
      const { data: aprovacoesData, error: aprovacoesError } = await supabase
        .from('aprovacoes_estagio')
        .select('*')
        .in('solicitacao_id', solicitacaoIds)
        .order('nivel', { ascending: true });

      if (aprovacoesError) throw aprovacoesError;

      // Montar objeto de solicitações com aprovações
      const solicitacoesCompletas: SolicitacaoAprovacaoEstagio[] = solicitacoesData.map(sol => {
        const aprovacoes = (aprovacoesData || []).filter(a => a.solicitacao_id === sol.id);
        
        // Encontrar aprovação atual (primeira pendente na sequência)
        const aprovacaoAtual = aprovacoes.find(a => {
          if (a.status !== 'pendente') return false;
          const anteriores = aprovacoes.filter(ap => ap.nivel < a.nivel);
          return anteriores.every(ap => ap.status === 'aprovado');
        }) || null;

        // Verificar se o usuário logado é o aprovador da vez
        const isAprovadorDaVez = aprovacaoAtual?.aprovador_integrante_id === meuIntegranteId;

        const integrante = sol.integrante as { nome_colete: string; divisao_texto: string; regional_texto: string; cargo_grau_texto: string } | null;
        const cargoEstagio = sol.cargo_estagio as { nome: string } | null;
        const solicitanteCargo = sol.solicitante_cargo as { nome: string } | null;
        const solicitanteDivisao = sol.solicitante_divisao as { nome: string } | null;

        return {
          id: sol.id,
          integrante_id: sol.integrante_id,
          integrante_nome_colete: integrante?.nome_colete || '',
          integrante_divisao_texto: integrante?.divisao_texto || '',
          integrante_regional_texto: integrante?.regional_texto || '',
          integrante_cargo_atual: integrante?.cargo_grau_texto || '',
          cargo_estagio_nome: cargoEstagio?.nome || '',
          cargo_estagio_id: sol.cargo_estagio_id,
          grau_estagio: sol.grau_estagio,
          solicitante_nome_colete: sol.solicitante_nome_colete,
          solicitante_cargo: solicitanteCargo?.nome || null,
          solicitante_divisao_texto: solicitanteDivisao?.nome || null,
          created_at: sol.created_at,
          tempo_estagio_meses: sol.tempo_estagio_meses || 6,
          data_termino_previsto: sol.data_termino_previsto || '',
          data_inicio_estagio: sol.data_inicio_estagio || '',
          aprovacoes: aprovacoes.map(a => ({
            id: a.id,
            nivel: a.nivel,
            tipo_aprovador: a.tipo_aprovador,
            aprovador_integrante_id: a.aprovador_integrante_id,
            aprovador_nome_colete: a.aprovador_nome_colete,
            aprovador_cargo: a.aprovador_cargo,
            status: a.status,
            data_hora_acao: a.data_hora_acao,
            justificativa_rejeicao: a.justificativa_rejeicao
          })),
          aprovacaoAtual,
          isAprovadorDaVez
        };
      });

      // Filtrar apenas solicitações onde o usuário é aprovador da vez
      const minhasSolicitacoes = solicitacoesCompletas.filter(s => s.isAprovadorDaVez);
      setSolicitacoes(minhasSolicitacoes);

    } catch (error) {
      console.error('Erro ao buscar solicitações de estágio:', error);
      toast.error('Erro ao carregar aprovações pendentes');
    } finally {
      setLoading(false);
    }
  }, [meuIntegranteId]);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  async function aprovar(aprovacaoId: string, solicitacaoId: string): Promise<boolean> {
    try {
      setOperando(true);

      // Atualizar aprovação
      const { error: updateError } = await supabase
        .from('aprovacoes_estagio')
        .update({
          status: 'aprovado',
          data_hora_acao: new Date().toISOString()
        })
        .eq('id', aprovacaoId);

      if (updateError) throw updateError;

      // Verificar se todas as aprovações estão completas
      const { data: todasAprovacoes } = await supabase
        .from('aprovacoes_estagio')
        .select('status')
        .eq('solicitacao_id', solicitacaoId);

      const todasAprovadas = todasAprovacoes?.every(a => a.status === 'aprovado');

      if (todasAprovadas) {
        // Buscar dados da solicitação
        const { data: solicitacao } = await supabase
          .from('solicitacoes_estagio')
          .select('integrante_id, cargo_estagio_id, data_inicio_estagio')
          .eq('id', solicitacaoId)
          .single();

        if (solicitacao) {
          // Atualizar status da solicitação
          await supabase
            .from('solicitacoes_estagio')
            .update({
              status: 'Em Estagio',
              data_aprovacao: new Date().toISOString()
            })
            .eq('id', solicitacaoId);

          // Atualizar cargo_estagio_id do integrante
          await supabase
            .from('integrantes_portal')
            .update({ cargo_estagio_id: solicitacao.cargo_estagio_id })
            .eq('id', solicitacao.integrante_id);
        }

        toast.success('Solicitação aprovada! Estágio iniciado.');
      } else {
        toast.success('Aprovação registrada. Aguardando próximo aprovador.');
      }

      await fetchSolicitacoes();
      return true;

    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error('Erro ao registrar aprovação');
      return false;
    } finally {
      setOperando(false);
    }
  }

  async function rejeitar(aprovacaoId: string, solicitacaoId: string, justificativa: string): Promise<boolean> {
    try {
      setOperando(true);

      // Atualizar aprovação com rejeição
      const { error: updateError } = await supabase
        .from('aprovacoes_estagio')
        .update({
          status: 'reprovado',
          data_hora_acao: new Date().toISOString(),
          justificativa_rejeicao: justificativa
        })
        .eq('id', aprovacaoId);

      if (updateError) throw updateError;

      // Buscar integrante_id
      const { data: solicitacao } = await supabase
        .from('solicitacoes_estagio')
        .select('integrante_id')
        .eq('id', solicitacaoId)
        .single();

      // Atualizar status da solicitação para Reprovado
      await supabase
        .from('solicitacoes_estagio')
        .update({ status: 'Reprovado' })
        .eq('id', solicitacaoId);

      // Limpar cargo_estagio_id do integrante
      if (solicitacao) {
        await supabase
          .from('integrantes_portal')
          .update({ cargo_estagio_id: null })
          .eq('id', solicitacao.integrante_id);
      }

      toast.success('Solicitação rejeitada.');
      await fetchSolicitacoes();
      return true;

    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast.error('Erro ao registrar rejeição');
      return false;
    } finally {
      setOperando(false);
    }
  }

  return {
    solicitacoes,
    loading,
    operando,
    aprovar,
    rejeitar,
    refetch: fetchSolicitacoes
  };
}
