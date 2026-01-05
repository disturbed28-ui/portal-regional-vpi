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

interface EventoCanceladoDetalhes {
  id: string;
  evento_google_id: string;
  titulo: string;
  data_evento: string;
  divisao_nome: string | null;
  status: 'cancelled' | 'removed';
  total_presencas: number;
}

interface TreinamentoAprovadorDetalhes {
  solicitacao_id: string;
  integrante_nome_colete: string;
  integrante_cargo_atual: string;
  cargo_treinamento: string;
  divisao_texto: string;
  regional_texto: string;
  created_at: string;
  aprovadores_pendentes: string[];
}

interface TreinamentoIntegranteDetalhes {
  solicitacao_id: string;
  cargo_treinamento: string;
  divisao_texto: string;
  diretor_divisao_nome: string;
  diretor_divisao_cargo: string;
  created_at: string;
}

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento' | 'delta' | 'evento_cancelado' | 'treinamento_aprovador' | 'treinamento_integrante';
  detalhe: string;
  data_ref: string;
  registro_id: number;
  detalhes_completos: MensalidadeDetalhes | AfastamentoDetalhes | DeltaDetalhes | EventoCanceladoDetalhes | TreinamentoAprovadorDetalhes | TreinamentoIntegranteDetalhes;
}

export type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes, DeltaDetalhes, EventoCanceladoDetalhes, TreinamentoAprovadorDetalhes, TreinamentoIntegranteDetalhes };

export const usePendencias = (
  userId: string | undefined,
  userRole: 'admin' | 'diretor_regional' | 'diretor_divisao' | 'regional' | 'user' | null,
  regionalId?: string,
  divisaoId?: string,
  registroId?: number
) => {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Função para forçar refetch
  const refetch = () => {
    // Limpar todos os caches de pendências
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pendencias_')) {
        localStorage.removeItem(key);
      }
    });
    setRefreshTrigger(prev => prev + 1);
  };

  // Cache de 5 minutos (ao invés de diário)
  const getCacheKey = () => {
    const cacheTime = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 minutos
    return `pendencias_v5_${userId}_${userRole}_${divisaoId || 'no_div'}_${registroId || 'all'}_${cacheTime}`;
  };

  useEffect(() => {
    if (!userId || !userRole) {
      console.log('[usePendencias] Aguardando userId e userRole...');
      setLoading(false);
      return;
    }

    // PROTEÇÃO: Diretor de divisão PRECISA ter divisaoId
    if (userRole === 'diretor_divisao' && !divisaoId) {
      console.warn('[usePendencias] ⚠️ diretor_divisao sem divisaoId - aguardando profile carregar...');
      setLoading(false);
      setPendencias([]);
      return;
    }

    console.log('[usePendencias] ✅ Iniciando com:', { userId, userRole, regionalId, divisaoId, registroId });

    // Detectar page refresh e invalidar cache
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isPageRefresh = navEntry?.type === 'reload';
    
    if (isPageRefresh) {
      console.log('[usePendencias] 🔄 Page refresh detectado, invalidando cache...');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pendencias_')) {
          localStorage.removeItem(key);
        }
      });
    }

    // Limpar caches antigos (versões v1, v2, v3 e v4)
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pendencias_') && !key.includes('_v5_')) {
        console.log('[usePendencias] Removendo cache antigo:', key);
        localStorage.removeItem(key);
      }
    });

    // Cache de 5 minutos (nova versão v5)
    const cacheKey = getCacheKey();
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
        
        if (!isValidStructure) {
          console.log('[usePendencias] Cache com estrutura inválida, buscando novamente...');
          localStorage.removeItem(cacheKey);
        } else {
          // Validação de consistência para diretor_divisao
          // Forçar nova busca se houver pendências de outras divisões no cache
          if (userRole === 'diretor_divisao' && divisaoId && parsedData.length > 0) {
            console.log('[usePendencias] Validando consistência do cache para diretor_divisao...');
            
            // Verificar se há pendências sem divisao_texto (cache antigo/corrompido)
            const temPendenciasInvalidas = parsedData.some((p: Pendencia) => !p.divisao_texto);
            
            if (temPendenciasInvalidas) {
              console.warn('[usePendencias] ⚠️ Cache com estrutura antiga detectado, invalidando...');
              localStorage.removeItem(cacheKey);
              // Continuar para buscar novamente com filtro correto
            } else {
              console.log('[usePendencias] ✅ Cache consistente, usando dados cacheados');
              setPendencias(parsedData);
              setLoading(false);
              return;
            }
          } else {
            // Para outros roles, usar cache normalmente
            setPendencias(parsedData);
            setLoading(false);
            return;
          }
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
        if (!divisaoId) {
          console.error('[usePendencias] ❌ ERRO CRÍTICO: diretor_divisao sem divisaoId no fetchPendencias');
          setLoading(false);
          return;
        }
        
        // Buscar nome da divisão para filtrar por divisao_texto (mais confiável que divisao_id)
        const { data: divisaoData } = await supabase
          .from('divisoes')
          .select('nome')
          .eq('id', divisaoId)
          .single();
        
        if (divisaoData?.nome) {
          console.log('[usePendencias] 🎯 Filtro diretor_divisao por divisao_texto:', divisaoData.nome);
          queryMensalidades = queryMensalidades.eq('divisao_texto', divisaoData.nome);
        } else {
          console.error('[usePendencias] ❌ Divisão não encontrada:', divisaoId);
          setLoading(false);
          return;
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
        if (!divisaoId) {
          console.error('[usePendencias] ❌ diretor_divisao sem divisaoId - pulando afastados');
        } else {
          // Buscar nome da divisão para filtrar por divisao_texto
          const { data: divisaoDataAfastados } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisaoId)
            .single();
          
          if (divisaoDataAfastados?.nome) {
            console.log('[usePendencias] 🎯 Filtro afastados por divisao_texto:', divisaoDataAfastados.nome);
            queryAfastados = queryAfastados.eq('divisao_texto', divisaoDataAfastados.nome);
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
        if (!divisaoId) {
          console.error('[usePendencias] ❌ diretor_divisao sem divisaoId - pulando deltas');
        } else {
          // Buscar nome da divisão para filtrar por divisao_texto
          const { data: divisaoDataDeltas } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisaoId)
            .single();
          
          if (divisaoDataDeltas?.nome) {
            console.log('[usePendencias] 🎯 Filtro deltas por divisao_texto:', divisaoDataDeltas.nome);
            queryDeltas = queryDeltas.eq('divisao_texto', divisaoDataDeltas.nome);
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
        // PROTEÇÃO: Pular deltas com dados incompletos
        if (!d || !d.tipo_delta) {
          console.warn('[usePendencias] Delta com dados incompletos encontrado:', {
            registro_id: d?.registro_id,
            nome_colete: d?.nome_colete,
            tipo_delta: d?.tipo_delta
          });
          return; // Pula este delta
        }
        
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

      // 4. Eventos cancelados/removidos pendentes de tratamento (apenas para admins)
      if (userRole === 'admin') {
        console.log('[usePendencias] Buscando eventos cancelados/removidos...');
        
        const { data: eventosProblematicos, error: errorEventos } = await supabase
          .from('eventos_agenda')
          .select(`
            id, evento_id, titulo, data_evento, status,
            divisoes:divisao_id (nome)
          `)
          .in('status', ['cancelled', 'removed']);

        if (!errorEventos && eventosProblematicos) {
          // Filtrar apenas os que têm presenças
          for (const evento of eventosProblematicos) {
            const { count } = await supabase
              .from('presencas')
              .select('*', { count: 'exact', head: true })
              .eq('evento_agenda_id', evento.id);

            if (count && count > 0) {
              const statusLabel = evento.status === 'cancelled' 
                ? '📅 Cancelado no Google' 
                : '❌ Removido do Google';

              todasPendencias.push({
                registro_id: 0,
                nome_colete: evento.titulo,
                divisao_texto: (evento.divisoes as any)?.nome || 'Sem divisão',
                tipo: 'evento_cancelado',
                detalhe: `${statusLabel} - ${count} presenças`,
                data_ref: evento.data_evento,
                detalhes_completos: {
                  id: evento.id,
                  evento_google_id: evento.evento_id,
                  titulo: evento.titulo,
                  data_evento: evento.data_evento,
                  divisao_nome: (evento.divisoes as any)?.nome || null,
                  status: evento.status as 'cancelled' | 'removed',
                  total_presencas: count
                }
              });
            }
          }
        }

        console.log('[usePendencias] Eventos cancelados/removidos encontrados:', 
          todasPendencias.filter(p => p.tipo === 'evento_cancelado').length);
      }

      // 5. Pendências de Aprovação de Treinamento
      console.log('[usePendencias] Buscando pendências de treinamento...');

      // Buscar integrante_id do usuário logado
      const { data: meuIntegrante } = await supabase
        .from('integrantes_portal')
        .select('id')
        .eq('profile_id', userId)
        .single();

      const meuIntegranteId = meuIntegrante?.id;

      if (meuIntegranteId) {
        // Buscar solicitações em aprovação
        const { data: solicitacoes } = await supabase
          .from('solicitacoes_treinamento')
          .select(`
            id, created_at,
            integrante:integrantes_portal!solicitacoes_treinamento_integrante_id_fkey(
              id, nome_colete, divisao_texto, regional_texto, cargo_grau_texto
            ),
            cargo_treinamento:cargos!solicitacoes_treinamento_cargo_treinamento_id_fkey(nome)
          `)
          .eq('status', 'Em Aprovacao');

        // Buscar aprovações dessas solicitações
        const solicitacaoIds = solicitacoes?.map(s => s.id) || [];
        
        if (solicitacaoIds.length > 0) {
          const { data: aprovacoes } = await supabase
            .from('aprovacoes_treinamento')
            .select('*')
            .in('solicitacao_id', solicitacaoIds);

          for (const sol of solicitacoes || []) {
            const integrante = sol.integrante as any;
            const cargoTreinamento = sol.cargo_treinamento as any;
            const aprovacoesDoSol = aprovacoes?.filter(a => a.solicitacao_id === sol.id) || [];
            
            // Verificar se o usuário é o integrante em treinamento
            if (integrante?.id === meuIntegranteId) {
              // Buscar Diretor da Divisão do integrante
              const diretorDivisao = aprovacoesDoSol.find(a => a.nivel === 1);
              
              todasPendencias.push({
                registro_id: 0,
                nome_colete: 'Treinamento aguardando aprovação',
                divisao_texto: integrante?.divisao_texto || '',
                tipo: 'treinamento_integrante',
                detalhe: 'Seu treinamento ainda não foi iniciado',
                data_ref: sol.created_at,
                detalhes_completos: {
                  solicitacao_id: sol.id,
                  cargo_treinamento: cargoTreinamento?.nome || 'N/A',
                  divisao_texto: integrante?.divisao_texto || 'N/A',
                  diretor_divisao_nome: diretorDivisao?.aprovador_nome_colete || 'N/A',
                  diretor_divisao_cargo: diretorDivisao?.aprovador_cargo || 'N/A',
                  created_at: sol.created_at
                }
              });
            }
            
            // Verificar se o usuário é um dos aprovadores
            const souAprovador = aprovacoesDoSol.some(
              a => a.aprovador_integrante_id === meuIntegranteId
            );
            
            if (souAprovador) {
              const aprovadoresPendentes = aprovacoesDoSol
                .filter(a => a.status === 'pendente')
                .map(a => a.aprovador_nome_colete || 'N/A');
              
              todasPendencias.push({
                registro_id: 0,
                nome_colete: 'Pendência de Aprovação de Treinamento',
                divisao_texto: integrante?.divisao_texto || '',
                tipo: 'treinamento_aprovador',
                detalhe: 'Aguardando aprovações',
                data_ref: sol.created_at,
                detalhes_completos: {
                  solicitacao_id: sol.id,
                  integrante_nome_colete: integrante?.nome_colete || 'N/A',
                  integrante_cargo_atual: integrante?.cargo_grau_texto || 'N/A',
                  cargo_treinamento: cargoTreinamento?.nome || 'N/A',
                  divisao_texto: integrante?.divisao_texto || 'N/A',
                  regional_texto: integrante?.regional_texto || 'N/A',
                  created_at: sol.created_at,
                  aprovadores_pendentes: aprovadoresPendentes
                }
              });
            }
          }
        }
        
        console.log('[usePendencias] Pendências de treinamento encontradas:', 
          todasPendencias.filter(p => p.tipo === 'treinamento_aprovador' || p.tipo === 'treinamento_integrante').length);
      }

      // Ordenar: deltas críticos primeiro, depois eventos cancelados, depois por data
      todasPendencias.sort((a, b) => {
        // Eventos cancelados têm prioridade alta (mas menor que deltas críticos)
        if (a.tipo === 'evento_cancelado' && b.tipo !== 'evento_cancelado') return -1;
        if (b.tipo === 'evento_cancelado' && a.tipo !== 'evento_cancelado') return 1;
        
        if (a.tipo === 'delta' && b.tipo === 'delta') {
          // PROTEÇÃO CRÍTICA: Verificar se detalhes_completos existe
          const detalhesA = a.detalhes_completos as DeltaDetalhes | null;
          const detalhesB = b.detalhes_completos as DeltaDetalhes | null;
          
          if (!detalhesA || !detalhesB) {
            console.warn('[usePendencias] Delta sem detalhes_completos encontrado na ordenação');
            return !detalhesA ? 1 : -1; // Coloca null no final
          }
          
          const prioA = detalhesA.prioridade;
          const prioB = detalhesB.prioridade;
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
  }, [userId, userRole, regionalId, divisaoId, registroId, refreshTrigger]);

  return { pendencias, loading, totalPendencias: pendencias.length, refetch };
};
