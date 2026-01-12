import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getNivelAcesso } from '@/lib/grauUtils';

export interface HistoricoAlteracao {
  id: string;
  created_at: string;
  acao: string;
  
  // Integrante afetado
  integrante_id: string;
  integrante_nome_colete: string;
  integrante_divisao: string | null;
  integrante_regional: string | null;
  integrante_regional_id: string | null;
  integrante_divisao_id: string | null;
  
  // Editor (quem alterou)
  editor_id: string | null;
  editor_nome_colete: string | null;
  editor_cargo: string | null;
  editor_divisao: string | null;
  
  // Alterações
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  observacao: string | null;
}

export interface FiltrosHistorico {
  busca: string;
  campoAlterado: string;
  dataInicio: Date | null;
  dataFim: Date | null;
}

// Labels amigáveis para campos técnicos
export const LABELS_CAMPOS: Record<string, string> = {
  nome_colete: 'Nome Colete',
  regional_texto: 'Regional',
  divisao_texto: 'Divisão',
  cargo_grau_texto: 'Cargo/Grau',
  cargo_nome: 'Cargo',
  grau: 'Grau',
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
  data_entrada: 'Data de Entrada',
  nome_civil: 'Nome Civil',
  email: 'Email',
  telefone: 'Telefone',
  telefone_emergencia: 'Telefone Emergência',
  whatsapp: 'WhatsApp',
  cpf: 'CPF',
  endereco: 'Endereço',
  cep: 'CEP',
  cidade: 'Cidade',
  estado: 'Estado',
  data_nascimento: 'Data de Nascimento',
  tipo_sanguineo: 'Tipo Sanguíneo',
  alergias: 'Alergias',
  medicamentos: 'Medicamentos',
  observacoes: 'Observações',
  funcao_id: 'Função',
  cargo_id: 'Cargo',
  divisao_id: 'Divisão',
  regional_id: 'Regional',
  ativo: 'Status Ativo',
};

// Ações que são edições de perfil (não movimentações administrativas)
const ACOES_EDICAO_PERFIL = ['update_profile', 'CADASTRO_MANUAL', 'edicao_perfil'];

export function useHistoricoIntegrantes(filtros: FiltrosHistorico) {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  
  const nivelAcesso = useMemo(() => {
    return getNivelAcesso(profile?.grau);
  }, [profile?.grau]);

  const fetchHistorico = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Query principal - RLS já filtra por visibilidade
      let query = supabase
        .from('integrantes_historico')
        .select(`
          id,
          created_at,
          acao,
          integrante_id,
          alterado_por,
          dados_anteriores,
          dados_novos,
          observacao,
          integrante:integrantes_portal!integrante_id (
            nome_colete,
            divisao_texto,
            regional_texto,
            regional_id,
            divisao_id
          )
        `)
        .in('acao', ACOES_EDICAO_PERFIL)
        .order('created_at', { ascending: false })
        .limit(200);
      
      // Filtro por período
      if (filtros.dataInicio) {
        query = query.gte('created_at', filtros.dataInicio.toISOString());
      }
      if (filtros.dataFim) {
        const fimDoDia = new Date(filtros.dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        query = query.lte('created_at', fimDoDia.toISOString());
      }
      
      const { data, error: queryError } = await query;
      
      if (queryError) {
        console.error('Erro ao buscar histórico:', queryError);
        setError(queryError.message);
        setHistorico([]);
        return;
      }
      
      if (!data || data.length === 0) {
        setHistorico([]);
        return;
      }
      
      // Buscar dados dos editores
      const editorIds = [...new Set(data.map(h => h.alterado_por).filter(Boolean))];
      
      let editoresMap: Record<string, { nome_colete: string; cargo_grau_texto: string | null; divisao_texto: string | null }> = {};
      
      if (editorIds.length > 0) {
        // Buscar integrantes que são editores (pelo profile_id)
        const { data: editoresData } = await supabase
          .from('integrantes_portal')
          .select('profile_id, nome_colete, cargo_grau_texto, divisao_texto')
          .in('profile_id', editorIds);
        
        if (editoresData) {
          editoresData.forEach(e => {
            if (e.profile_id) {
              editoresMap[e.profile_id] = {
                nome_colete: e.nome_colete,
                cargo_grau_texto: e.cargo_grau_texto,
                divisao_texto: e.divisao_texto
              };
            }
          });
        }
      }
      
      // Montar dados finais
      const historicoFormatado: HistoricoAlteracao[] = data
        .filter(item => item.integrante)
        .map(item => {
          const integrante = item.integrante as {
            nome_colete: string;
            divisao_texto: string | null;
            regional_texto: string | null;
            regional_id: string | null;
            divisao_id: string | null;
          };
          
          const editor = item.alterado_por ? editoresMap[item.alterado_por] : null;
          
          return {
            id: item.id,
            created_at: item.created_at,
            acao: item.acao,
            integrante_id: item.integrante_id,
            integrante_nome_colete: integrante.nome_colete,
            integrante_divisao: integrante.divisao_texto,
            integrante_regional: integrante.regional_texto,
            integrante_regional_id: integrante.regional_id,
            integrante_divisao_id: integrante.divisao_id,
            editor_id: item.alterado_por,
            editor_nome_colete: editor?.nome_colete || null,
            editor_cargo: editor?.cargo_grau_texto || null,
            editor_divisao: editor?.divisao_texto || null,
            dados_anteriores: item.dados_anteriores as Record<string, unknown> | null,
            dados_novos: item.dados_novos as Record<string, unknown> | null,
            observacao: item.observacao
          };
        });
      
      setHistorico(historicoFormatado);
    } catch (err) {
      console.error('Erro inesperado ao buscar histórico:', err);
      setError('Erro ao carregar histórico');
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filtros.dataInicio, filtros.dataFim]);
  
  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);
  
  // Filtrar localmente por busca e campo
  const historicoFiltrado = useMemo(() => {
    let resultado = historico;
    
    // Filtro por busca (nome do integrante)
    if (filtros.busca.trim()) {
      const termo = filtros.busca.toLowerCase().trim();
      resultado = resultado.filter(h => 
        h.integrante_nome_colete.toLowerCase().includes(termo)
      );
    }
    
    // Filtro por campo alterado
    if (filtros.campoAlterado && filtros.campoAlterado !== 'todos') {
      resultado = resultado.filter(h => {
        if (!h.dados_anteriores && !h.dados_novos) return false;
        
        const anterior = h.dados_anteriores || {};
        const novo = h.dados_novos || {};
        
        // Verificar se o campo específico foi alterado
        return filtros.campoAlterado in anterior || filtros.campoAlterado in novo;
      });
    }
    
    return resultado;
  }, [historico, filtros.busca, filtros.campoAlterado]);
  
  // Lista de campos disponíveis para filtro
  const camposDisponiveis = useMemo(() => {
    const campos = new Set<string>();
    
    historico.forEach(h => {
      const anterior = h.dados_anteriores || {};
      const novo = h.dados_novos || {};
      
      Object.keys(anterior).forEach(k => campos.add(k));
      Object.keys(novo).forEach(k => campos.add(k));
    });
    
    return Array.from(campos)
      .filter(c => LABELS_CAMPOS[c]) // Apenas campos com label definido
      .sort((a, b) => (LABELS_CAMPOS[a] || a).localeCompare(LABELS_CAMPOS[b] || b));
  }, [historico]);
  
  return {
    historico: historicoFiltrado,
    loading,
    error,
    refetch: fetchHistorico,
    nivelAcesso,
    camposDisponiveis
  };
}

// Função utilitária para extrair alterações de um registro
export function extrairAlteracoes(
  anterior: Record<string, unknown> | null,
  novo: Record<string, unknown> | null
): Array<{ campo: string; label: string; valorAnterior: string; valorNovo: string }> {
  const alteracoes: Array<{ campo: string; label: string; valorAnterior: string; valorNovo: string }> = [];
  
  const anteriorObj = anterior || {};
  const novoObj = novo || {};
  
  const todosCampos = new Set([...Object.keys(anteriorObj), ...Object.keys(novoObj)]);
  
  todosCampos.forEach(campo => {
    const valorAnterior = anteriorObj[campo];
    const valorNovo = novoObj[campo];
    
    // Só incluir se houve mudança
    if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNovo)) {
      alteracoes.push({
        campo,
        label: LABELS_CAMPOS[campo] || campo,
        valorAnterior: formatarValor(valorAnterior),
        valorNovo: formatarValor(valorNovo)
      });
    }
  });
  
  return alteracoes;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}
