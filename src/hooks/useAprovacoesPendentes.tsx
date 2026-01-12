import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Aprovacao {
  id: string;
  nivel: number;
  tipo_aprovador: string;
  aprovador_integrante_id: string | null;
  aprovador_nome_colete: string | null;
  aprovador_cargo: string | null;
  status: string;
  data_hora_acao: string | null;
  justificativa_rejeicao: string | null;
  aprovado_por_escalacao?: boolean;
  justificativa_escalacao?: string | null;
}

interface SolicitacaoAprovacao {
  id: string;
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao_texto: string;
  integrante_regional_texto: string;
  integrante_regional_id: string | null;
  integrante_cargo_atual: string;
  cargo_treinamento_nome: string;
  cargo_treinamento_id: string;
  solicitante_nome_colete: string;
  solicitante_cargo: string | null;
  solicitante_divisao_texto: string | null;
  created_at: string;
  tempo_treinamento_meses: number;
  data_termino_previsto: string;
  data_inicio_treinamento: string;
  aprovacoes: Aprovacao[];
  aprovacaoAtual: Aprovacao | null;
  isAprovadorDaVez: boolean;
  podeDRescalar: boolean;
}

export function useAprovacoesPendentes(userId: string | undefined) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [operando, setOperando] = useState(false);
  const [meuIntegranteId, setMeuIntegranteId] = useState<string | null>(null);
  const [meuIntegranteNome, setMeuIntegranteNome] = useState<string | null>(null);
  const [minhaRegionalId, setMinhaRegionalId] = useState<string | null>(null);
  const [soDiretorRegional, setSouDiretorRegional] = useState(false);

  // Buscar integrante_id e dados do usuário logado
  useEffect(() => {
    async function fetchMeuIntegrante() {
      if (!userId) return;

      const { data } = await supabase
        .from('integrantes_portal')
        .select('id, nome_colete, regional_id, cargo_grau_texto')
        .eq('profile_id', userId)
        .single();

      if (data) {
        setMeuIntegranteId(data.id);
        setMeuIntegranteNome(data.nome_colete);
        setMinhaRegionalId(data.regional_id);
        // Verificar se é Diretor Regional
        const cargoNormalizado = (data.cargo_grau_texto || '').toLowerCase();
        const ehDR = cargoNormalizado.includes('diretor') && cargoNormalizado.includes('regional');
        setSouDiretorRegional(ehDR);
      }
    }

    fetchMeuIntegrante();
  }, [userId]);

  const fetchSolicitacoes = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Buscar solicitações com status "Em Aprovacao"
      const { data: solicitacoesData, error: solError } = await supabase
        .from('solicitacoes_treinamento')
        .select(`
          id,
          integrante_id,
          cargo_treinamento_id,
          solicitante_nome_colete,
          created_at,
          tempo_treinamento_meses,
          data_termino_previsto,
          data_inicio_treinamento,
          integrante:integrantes_portal!solicitacoes_treinamento_integrante_id_fkey(
            nome_colete,
            divisao_texto,
            regional_texto,
            regional_id,
            cargo_grau_texto
          ),
          cargo_treinamento:cargos!solicitacoes_treinamento_cargo_treinamento_id_fkey(nome),
          solicitante_cargo:cargos!solicitacoes_treinamento_solicitante_cargo_id_fkey(nome),
          solicitante_divisao:divisoes!solicitacoes_treinamento_solicitante_divisao_id_fkey(nome)
        `)
        .eq('status', 'Em Aprovacao')
        .order('created_at', { ascending: false });

      if (solError) {
        console.error('Erro ao buscar solicitações:', solError);
        setLoading(false);
        return;
      }

      if (!solicitacoesData || solicitacoesData.length === 0) {
        setSolicitacoes([]);
        setLoading(false);
        return;
      }

      // Buscar aprovações para cada solicitação
      const solicitacaoIds = solicitacoesData.map(s => s.id);
      const { data: aprovacoes, error: apError } = await supabase
        .from('aprovacoes_treinamento')
        .select('*')
        .in('solicitacao_id', solicitacaoIds)
        .order('nivel', { ascending: true });

      if (apError) {
        console.error('Erro ao buscar aprovações:', apError);
      }

      // Montar o resultado
      const resultado: SolicitacaoAprovacao[] = solicitacoesData.map(sol => {
        const integrante = sol.integrante as { nome_colete: string; divisao_texto: string; regional_texto: string; regional_id: string | null; cargo_grau_texto: string } | null;
        const cargoTreinamento = sol.cargo_treinamento as { nome: string } | null;
        const solicitanteCargo = sol.solicitante_cargo as { nome: string } | null;
        const solicitanteDivisao = sol.solicitante_divisao as { nome: string } | null;

        const aprovacoesDoSol = aprovacoes?.filter(a => a.solicitacao_id === sol.id) || [];
        
        // Encontrar a aprovação atual (primeira pendente na ordem)
        const aprovacaoAtual = aprovacoesDoSol.find(a => a.status === 'pendente') || null;
        
        // Verificar se o usuário logado é o aprovador da vez
        const isAprovadorDaVez = aprovacaoAtual?.aprovador_integrante_id === meuIntegranteId;

        // Verificar se o DR pode escalar (aprovar fora da vez)
        // Condições: é DR, é da mesma regional, há aprovação pendente, e não é seu turno normal
        const integranteRegionalId = integrante?.regional_id;
        const temAprovacaoPendente = aprovacoesDoSol.some(a => a.status === 'pendente');
        const mesmRegional = integranteRegionalId && minhaRegionalId && integranteRegionalId === minhaRegionalId;
        const podeDRescalar = soDiretorRegional && mesmRegional && temAprovacaoPendente && !isAprovadorDaVez;

        return {
          id: sol.id,
          integrante_id: sol.integrante_id,
          integrante_nome_colete: integrante?.nome_colete || 'N/A',
          integrante_divisao_texto: integrante?.divisao_texto || 'N/A',
          integrante_regional_texto: integrante?.regional_texto || 'N/A',
          integrante_regional_id: integrante?.regional_id || null,
          integrante_cargo_atual: integrante?.cargo_grau_texto || 'N/A',
          cargo_treinamento_nome: cargoTreinamento?.nome || 'N/A',
          cargo_treinamento_id: sol.cargo_treinamento_id,
          solicitante_nome_colete: sol.solicitante_nome_colete || 'N/A',
          solicitante_cargo: solicitanteCargo?.nome || null,
          solicitante_divisao_texto: solicitanteDivisao?.nome || null,
          created_at: sol.created_at,
          tempo_treinamento_meses: sol.tempo_treinamento_meses || 3,
          data_termino_previsto: sol.data_termino_previsto || '',
          data_inicio_treinamento: sol.data_inicio_treinamento || '',
          aprovacoes: aprovacoesDoSol.map(a => ({
            id: a.id,
            nivel: a.nivel,
            tipo_aprovador: a.tipo_aprovador,
            aprovador_integrante_id: a.aprovador_integrante_id,
            aprovador_nome_colete: a.aprovador_nome_colete,
            aprovador_cargo: a.aprovador_cargo,
            status: a.status,
            data_hora_acao: a.data_hora_acao,
            justificativa_rejeicao: a.justificativa_rejeicao,
            aprovado_por_escalacao: a.aprovado_por_escalacao,
            justificativa_escalacao: a.justificativa_escalacao
          })),
          aprovacaoAtual,
          isAprovadorDaVez,
          podeDRescalar
        };
      });

      setSolicitacoes(resultado);
    } finally {
      setLoading(false);
    }
  }, [userId, meuIntegranteId, minhaRegionalId, soDiretorRegional]);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  async function aprovar(aprovacaoId: string, solicitacaoId: string): Promise<boolean> {
    setOperando(true);

    try {
      // 1. Atualizar a aprovação para "aprovado"
      const { error: updateError } = await supabase
        .from('aprovacoes_treinamento')
        .update({
          status: 'aprovado',
          data_hora_acao: new Date().toISOString()
        })
        .eq('id', aprovacaoId);

      if (updateError) {
        console.error('Erro ao aprovar:', updateError);
        toast({
          title: 'Erro',
          description: 'Não foi possível registrar a aprovação.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Verificar se todas as aprovações estão concluídas
      const { data: todasAprovacoes, error: fetchError } = await supabase
        .from('aprovacoes_treinamento')
        .select('status')
        .eq('solicitacao_id', solicitacaoId);

      if (fetchError) {
        console.error('Erro ao verificar aprovações:', fetchError);
        await fetchSolicitacoes();
        return true;
      }

      const todasAprovadas = todasAprovacoes?.every(a => a.status === 'aprovado');

      if (todasAprovadas) {
        // 3. Buscar dados da solicitação para finalizar
        const { data: solicitacao } = await supabase
          .from('solicitacoes_treinamento')
          .select('integrante_id, cargo_treinamento_id')
          .eq('id', solicitacaoId)
          .single();

        if (solicitacao) {
          // 4. Atualizar status da solicitação para "Em Treinamento"
          await supabase
            .from('solicitacoes_treinamento')
            .update({
              status: 'Em Treinamento',
              data_aprovacao: new Date().toISOString()
            })
            .eq('id', solicitacaoId);

          // 5. Atualizar cargo_treinamento_id do integrante
          await supabase
            .from('integrantes_portal')
            .update({ cargo_treinamento_id: solicitacao.cargo_treinamento_id })
            .eq('id', solicitacao.integrante_id);

          toast({
            title: 'Treinamento Aprovado',
            description: 'Todas as aprovações foram concluídas. O treinamento está ativo.',
          });
        }
      } else {
        toast({
          title: 'Aprovação Registrada',
          description: 'Aguardando próximos aprovadores.',
        });
      }

      await fetchSolicitacoes();
      return true;
    } finally {
      setOperando(false);
    }
  }

  async function rejeitar(aprovacaoId: string, solicitacaoId: string, justificativa: string): Promise<boolean> {
    setOperando(true);

    try {
      // 1. Atualizar a aprovação para "reprovado"
      const { error: updateApError } = await supabase
        .from('aprovacoes_treinamento')
        .update({
          status: 'reprovado',
          data_hora_acao: new Date().toISOString(),
          justificativa_rejeicao: justificativa
        })
        .eq('id', aprovacaoId);

      if (updateApError) {
        console.error('Erro ao rejeitar aprovação:', updateApError);
        toast({
          title: 'Erro',
          description: 'Não foi possível registrar a rejeição.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Atualizar status da solicitação para "Reprovado"
      const { error: updateSolError } = await supabase
        .from('solicitacoes_treinamento')
        .update({ status: 'Reprovado' })
        .eq('id', solicitacaoId);

      if (updateSolError) {
        console.error('Erro ao atualizar solicitação:', updateSolError);
      }

      // 3. Limpar cargo_treinamento_id do integrante (se já estiver setado)
      const { data: solicitacao } = await supabase
        .from('solicitacoes_treinamento')
        .select('integrante_id')
        .eq('id', solicitacaoId)
        .single();

      if (solicitacao) {
        await supabase
          .from('integrantes_portal')
          .update({ cargo_treinamento_id: null })
          .eq('id', solicitacao.integrante_id);
      }

      toast({
        title: 'Solicitação Reprovada',
        description: 'A solicitação de treinamento foi rejeitada.',
        variant: 'destructive'
      });

      await fetchSolicitacoes();
      return true;
    } finally {
      setOperando(false);
    }
  }

  async function aprovarPorEscalacao(
    aprovacaoId: string, 
    solicitacaoId: string,
    justificativa: string
  ): Promise<boolean> {
    setOperando(true);

    try {
      // 1. Atualizar a aprovação para "aprovado" com dados de escalação
      const { error: updateError } = await supabase
        .from('aprovacoes_treinamento')
        .update({
          status: 'aprovado',
          data_hora_acao: new Date().toISOString(),
          aprovado_por_escalacao: true,
          aprovador_escalacao_id: meuIntegranteId,
          aprovador_escalacao_nome: meuIntegranteNome,
          justificativa_escalacao: justificativa
        })
        .eq('id', aprovacaoId);

      if (updateError) {
        console.error('Erro ao aprovar por escalação:', updateError);
        toast({
          title: 'Erro',
          description: 'Não foi possível registrar a aprovação por escalação.',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Verificar se todas as aprovações estão concluídas
      const { data: todasAprovacoes, error: fetchError } = await supabase
        .from('aprovacoes_treinamento')
        .select('status')
        .eq('solicitacao_id', solicitacaoId);

      if (fetchError) {
        console.error('Erro ao verificar aprovações:', fetchError);
        await fetchSolicitacoes();
        return true;
      }

      const todasAprovadas = todasAprovacoes?.every(a => a.status === 'aprovado');

      if (todasAprovadas) {
        // 3. Buscar dados da solicitação para finalizar
        const { data: solicitacao } = await supabase
          .from('solicitacoes_treinamento')
          .select('integrante_id, cargo_treinamento_id')
          .eq('id', solicitacaoId)
          .single();

        if (solicitacao) {
          // 4. Atualizar status da solicitação para "Em Treinamento"
          await supabase
            .from('solicitacoes_treinamento')
            .update({
              status: 'Em Treinamento',
              data_aprovacao: new Date().toISOString()
            })
            .eq('id', solicitacaoId);

          // 5. Atualizar cargo_treinamento_id do integrante
          await supabase
            .from('integrantes_portal')
            .update({ cargo_treinamento_id: solicitacao.cargo_treinamento_id })
            .eq('id', solicitacao.integrante_id);

          toast({
            title: 'Treinamento Aprovado por Escalação',
            description: 'Todas as aprovações foram concluídas. O treinamento está ativo.',
          });
        }
      } else {
        toast({
          title: 'Aprovação por Escalação Registrada',
          description: 'Etapa aprovada com justificativa. Aguardando próximos aprovadores.',
        });
      }

      await fetchSolicitacoes();
      return true;
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
    aprovarPorEscalacao,
    refetch: fetchSolicitacoes
  };
}
