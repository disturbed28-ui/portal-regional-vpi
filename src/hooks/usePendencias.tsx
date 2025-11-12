import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MensalidadeDetalhes {
  cargo_grau_texto: string | null;
  total_parcelas: number;
  valor_total: number;
  parcelas: Array<{
    ref: string;
    data_vencimento: string;
    valor: number;
    dias_atraso: number;
  }>;
  primeira_divida: string;
  ultima_divida: string;
}

interface AfastamentoDetalhes {
  tipo_afastamento: string;
  data_afastamento: string;
  data_retorno_prevista: string;
  dias_afastado: number;
  dias_atraso: number;
  observacoes: string | null;
  cargo_grau_texto: string | null;
}

interface DeltaDetalhes {
  id: string; // ID do delta na tabela deltas_pendentes
  cargo_grau_texto: string | null;
  tipo_delta: string;
  prioridade: number;
  carga_id: string;
  observacao_admin?: string;
  created_at: string;
  dados_adicionais?: any;
}

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento' | 'delta';
  detalhe: string;
  data_ref: string;
  registro_id: number;
  detalhes_completos: MensalidadeDetalhes | AfastamentoDetalhes | DeltaDetalhes;
}

export type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes, DeltaDetalhes };

export const usePendencias = (
  userId: string | undefined,
  userRole: 'admin' | 'diretor_regional' | 'diretor_divisao' | 'regional' | 'user' | null,
  regionalId?: string,
  divisaoId?: string,
  registroId?: number
) => {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !userRole) {
      console.log('[usePendencias] Aguardando userId e userRole...');
      setLoading(false);
      return;
    }

    console.log('[usePendencias] Iniciando com:', { userId, userRole, regionalId, divisaoId, registroId });

    // Limpar caches antigos (sem _v2)
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pendencias_') && !key.includes('_v2_')) {
        console.log('[usePendencias] Removendo cache antigo:', key);
        localStorage.removeItem(key);
      }
    });

    // Verificar cache do dia (nova versão)
    const data = new Date().toISOString().split('T')[0];
    const cacheKey = `pendencias_v2_${userId}_${userRole}_${registroId || 'all'}_${data}`;
    const cached = localStorage.getItem(cacheKey);
    
    console.log('[usePendencias] Cache key:', cacheKey);
    console.log('[usePendencias] Cache encontrado:', !!cached);
    
    if (cached) {
      try {
        const parsedData = JSON.parse(cached);
        console.log('[usePendencias] Cache válido encontrado, total:', parsedData.length);
        
        // Validação: Verificar se tem estrutura correta
        const isValidStructure = Array.isArray(parsedData) && 
          (parsedData.length === 0 || parsedData[0]?.detalhes_completos !== undefined);
        
        if (isValidStructure) {
          setPendencias(parsedData);
          setLoading(false);
          return;
        } else {
          console.log('[usePendencias] Cache com estrutura inválida, buscando novamente...');
          localStorage.removeItem(cacheKey);
        }
      } catch (error) {
        console.error('[usePendencias] Erro ao processar cache:', error);
        localStorage.removeItem(cacheKey);
      }
    }

    const fetchPendencias = async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const todasPendencias: Pendencia[] = [];

      // 1. Mensalidades atrasadas
      let queryMensalidades = supabase
        .from('mensalidades_atraso')
        .select('registro_id, nome_colete, divisao_texto, data_vencimento, ref, valor')
        .eq('ativo', true)
        .eq('liquidado', false)
        .lt('data_vencimento', hoje);

      // Aplicar filtro de escopo
      if (userRole === 'admin') {
        // Admin vê todas (não aplica filtro)
      } else if (userRole === 'diretor_regional' || userRole === 'regional') {
        // Diretor Regional vê sua regional
        if (regionalId) {
          const { data: divisoes } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('regional_id', regionalId);
          
          const nomeDivisoes = divisoes?.map(d => d.nome) || [];
          if (nomeDivisoes.length > 0) {
            queryMensalidades = queryMensalidades.in('divisao_texto', nomeDivisoes);
          }
        }
      } else if (userRole === 'diretor_divisao') {
        if (divisaoId) {
          const { data: divisao } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisaoId)
            .single();
          
          if (divisao) {
            // Usar ilike para matching robusto (ignora acentos e case)
            queryMensalidades = queryMensalidades.ilike('divisao_texto', divisao.nome);
          }
        }
      } else if (userRole === 'user' && registroId) {
        // Usuário comum: só vê suas próprias pendências
        queryMensalidades = queryMensalidades.eq('registro_id', registroId);
      }

      const { data: mensalidades, error: errorMensalidades } = await queryMensalidades;
      
      console.log('[usePendencias] Mensalidades query result:', {
        count: mensalidades?.length || 0,
        error: errorMensalidades,
        userRole,
        regionalId,
        divisaoId,
        registroId
      });

      // Agrupar por integrante e coletar TODAS as parcelas
      const mensalidadesMap = new Map();
      mensalidades?.forEach(m => {
        const key = `${m.registro_id}_${m.nome_colete}_${m.divisao_texto}`;
        
        if (!mensalidadesMap.has(key)) {
          mensalidadesMap.set(key, {
            registro_id: m.registro_id,
            nome_colete: m.nome_colete,
            divisao_texto: m.divisao_texto,
            parcelas: [],
            total_valor: 0,
            mais_antiga: m.data_vencimento,
            mais_recente: m.data_vencimento
          });
        }
        
        const entry = mensalidadesMap.get(key);
        const vencimento = new Date(m.data_vencimento);
        const diasAtraso = Math.floor((new Date().getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
        
        entry.parcelas.push({
          ref: m.ref,
          data_vencimento: m.data_vencimento,
          valor: m.valor || 0,
          dias_atraso: diasAtraso
        });
        
        entry.total_valor += (m.valor || 0);
        
        if (m.data_vencimento < entry.mais_antiga) {
          entry.mais_antiga = m.data_vencimento;
        }
        if (m.data_vencimento > entry.mais_recente) {
          entry.mais_recente = m.data_vencimento;
        }
      });

      // Buscar cargos dos integrantes das mensalidades
      const registroIdsMensalidades = Array.from(mensalidadesMap.values()).map(e => e.registro_id);
      const cargosMensalidadesMap = new Map<number, string | null>();
      
      if (registroIdsMensalidades.length > 0) {
        const { data: integrantesData } = await supabase
          .from('integrantes_portal')
          .select('registro_id, cargo_grau_texto')
          .in('registro_id', registroIdsMensalidades);
        
        integrantesData?.forEach(i => {
          cargosMensalidadesMap.set(i.registro_id, i.cargo_grau_texto);
        });
      }

      // Ordenar parcelas e criar pendências
      mensalidadesMap.forEach((entry) => {
        entry.parcelas.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
        
        todasPendencias.push({
          registro_id: entry.registro_id,
          nome_colete: entry.nome_colete,
          divisao_texto: entry.divisao_texto,
          tipo: 'mensalidade',
          detalhe: `${entry.parcelas.length} parcela(s) atrasada(s)`,
          data_ref: entry.mais_antiga,
          detalhes_completos: {
            cargo_grau_texto: cargosMensalidadesMap.get(entry.registro_id) || null,
            total_parcelas: entry.parcelas.length,
            valor_total: entry.total_valor,
            parcelas: entry.parcelas,
            primeira_divida: entry.mais_antiga,
            ultima_divida: entry.mais_recente
          }
        });
      });

      // 2. Afastamentos com retorno atrasado
      let queryAfastados = supabase
        .from('integrantes_afastados')
        .select(`
          registro_id,
          nome_colete,
          divisao_texto,
          data_retorno_prevista,
          data_afastamento,
          tipo_afastamento,
          observacoes,
          cargo_grau_texto
        `)
        .eq('ativo', true)
        .is('data_retorno_efetivo', null)
        .lt('data_retorno_prevista', hoje);

      // Aplicar filtro de escopo para afastamentos
      if (userRole === 'admin') {
        // Admin vê todos
      } else if (userRole === 'diretor_regional' || userRole === 'regional') {
        if (regionalId) {
          const { data: divisoes } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('regional_id', regionalId);
          
          const nomeDivisoes = divisoes?.map(d => d.nome) || [];
          if (nomeDivisoes.length > 0) {
            queryAfastados = queryAfastados.in('divisao_texto', nomeDivisoes);
          }
        }
      } else if (userRole === 'diretor_divisao') {
        if (divisaoId) {
          const { data: divisao } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisaoId)
            .single();
          
          if (divisao) {
            // Usar ilike para matching robusto (ignora acentos e case)
            queryAfastados = queryAfastados.ilike('divisao_texto', divisao.nome);
          }
        }
      } else if (userRole === 'user' && registroId) {
        // Usuário comum: só vê seus próprios afastamentos
        queryAfastados = queryAfastados.eq('registro_id', registroId);
      }

      const { data: afastados, error: errorAfastados } = await queryAfastados;
      
      console.log('[usePendencias] Afastados query result:', {
        count: afastados?.length || 0,
        error: errorAfastados,
        userRole,
        regionalId,
        divisaoId,
        registroId
      });

      afastados?.forEach(a => {
        const hoje = new Date();
        const retornoPrevisto = new Date(a.data_retorno_prevista);
        const dataAfastamento = new Date(a.data_afastamento);
        
        const diasAtraso = Math.floor(
          (hoje.getTime() - retornoPrevisto.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const diasAfastado = Math.floor(
          (hoje.getTime() - dataAfastamento.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        todasPendencias.push({
          registro_id: a.registro_id,
          nome_colete: a.nome_colete,
          divisao_texto: a.divisao_texto,
          tipo: 'afastamento',
          detalhe: `${diasAtraso} dia(s) de atraso no retorno`,
          data_ref: a.data_retorno_prevista,
          detalhes_completos: {
            tipo_afastamento: a.tipo_afastamento,
            data_afastamento: a.data_afastamento,
            data_retorno_prevista: a.data_retorno_prevista,
            dias_afastado: diasAfastado,
            dias_atraso: diasAtraso,
            observacoes: a.observacoes,
            cargo_grau_texto: a.cargo_grau_texto
          }
        });
      });

      // 3. Deltas pendentes
      let queryDeltas = supabase
        .from('deltas_pendentes')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: true });

      // Aplicar filtro de escopo
      if (userRole === 'admin') {
        // Admin vê todos
      } else if (userRole === 'diretor_regional' || userRole === 'regional') {
        if (regionalId) {
          const { data: divisoes } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('regional_id', regionalId);
          
          const nomeDivisoes = divisoes?.map(d => d.nome) || [];
          if (nomeDivisoes.length > 0) {
            queryDeltas = queryDeltas.in('divisao_texto', nomeDivisoes);
          }
        }
      } else if (userRole === 'diretor_divisao') {
        if (divisaoId) {
          const { data: divisao } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisaoId)
            .single();
          
          if (divisao) {
            // Usar ilike para matching robusto (ignora acentos e case)
            queryDeltas = queryDeltas.ilike('divisao_texto', divisao.nome);
          }
        }
      } else if (userRole === 'user' && registroId) {
        queryDeltas = queryDeltas.eq('registro_id', registroId);
      }

      const { data: deltas, error: errorDeltas } = await queryDeltas;
      
      console.log('[usePendencias] Deltas query result:', {
        count: deltas?.length || 0,
        error: errorDeltas
      });

      // Buscar cargos dos integrantes dos deltas
      const registroIdsDeltas = deltas?.map(d => d.registro_id) || [];
      const cargosDeltasMap = new Map<number, string | null>();
      
      if (registroIdsDeltas.length > 0) {
        const { data: integrantesData } = await supabase
          .from('integrantes_portal')
          .select('registro_id, cargo_grau_texto')
          .in('registro_id', registroIdsDeltas);
        
        integrantesData?.forEach(i => {
          cargosDeltasMap.set(i.registro_id, i.cargo_grau_texto);
        });
      }

      deltas?.forEach(d => {
        const tipoDeltaLabel = {
          'SUMIU_ATIVOS': '🚨 Desapareceu dos ativos',
          'NOVO_ATIVOS': '🆕 Novo integrante ativo',
          'SUMIU_AFASTADOS': '↩️ Saiu dos afastados',
          'NOVO_AFASTADOS': '⏸️ Novo afastamento',
          'RELACAO_DETECTADA': '🔗 Relação detectada'
        }[d.tipo_delta] || d.tipo_delta;
        
        todasPendencias.push({
          registro_id: d.registro_id,
          nome_colete: d.nome_colete,
          divisao_texto: d.divisao_texto,
          tipo: 'delta',
          detalhe: tipoDeltaLabel,
          data_ref: d.created_at,
          detalhes_completos: {
            id: d.id, // ID do delta
            cargo_grau_texto: cargosDeltasMap.get(d.registro_id) || null,
            tipo_delta: d.tipo_delta,
            prioridade: d.prioridade,
            carga_id: d.carga_id,
            observacao_admin: d.observacao_admin,
            created_at: d.created_at,
            dados_adicionais: d.dados_adicionais
          }
        });
      });

      // Ordenar: deltas críticos primeiro, depois por data
      todasPendencias.sort((a, b) => {
        if (a.tipo === 'delta' && b.tipo === 'delta') {
          const prioA = (a.detalhes_completos as DeltaDetalhes).prioridade;
          const prioB = (b.detalhes_completos as DeltaDetalhes).prioridade;
          if (prioA !== prioB) return prioB - prioA;
        }
        return a.data_ref.localeCompare(b.data_ref);
      });

      console.log('[usePendencias] Total de pendências encontradas:', todasPendencias.length);
      console.log('[usePendencias] Salvando no cache:', cacheKey);

      setPendencias(todasPendencias);
      localStorage.setItem(cacheKey, JSON.stringify(todasPendencias));
      setLoading(false);
    };

    fetchPendencias();
  }, [userId, userRole, regionalId, divisaoId, registroId]);

  return { pendencias, loading, totalPendencias: pendencias.length };
};
