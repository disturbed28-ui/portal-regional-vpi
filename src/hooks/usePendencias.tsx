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

interface EstagioAprovadorDetalhes {
  solicitacao_id: string;
  integrante_nome_colete: string;
  integrante_cargo_atual: string;
  cargo_estagio: string;
  grau_estagio: string;
  divisao_texto: string;
  regional_texto: string;
  created_at: string;
  aprovadores_pendentes: string[];
}

interface EstagioIntegranteDetalhes {
  solicitacao_id: string;
  cargo_estagio: string;
  grau_estagio: string;
  divisao_texto: string;
  diretor_divisao_nome: string;
  diretor_divisao_cargo: string;
  created_at: string;
}

interface AjusteRolesDetalhes {
  id: string;
  integrante_id: string;
  cargo_anterior: string | null;
  cargo_novo: string;
  grau_anterior: string | null;
  grau_novo: string | null;
  alterado_por_nome: string;
  justificativa: string;
  created_at: string;
}

interface DesligamentoCompulsorioDetalhes {
  cargo_grau_texto: string | null;
  total_parcelas: number;
  valor_total: number;
  maior_atraso_dias: number;
  parcelas: Array<{
    ref: string;
    data_vencimento: string;
    valor: number;
    dias_atraso: number;
  }>;
  primeira_divida: string;
  ultima_divida: string;
}

interface FlyerPendenteDetalhes {
  solicitacao_id: string;
  integrante_nome_colete: string;
  cargo_estagio_nome: string;
  grau_estagio: string;
  divisao_texto: string;
  status_flyer: string;
  data_aprovacao: string | null;
}

interface DadosDesatualizadosDetalhes {
  tipo_dado: 'integrantes' | 'inadimplencia' | 'aniversariantes' | 'afastados';
  label: string;
  ultima_atualizacao: string | null;
  dias_desde_atualizacao: number | null;
}

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento' | 'delta' | 'evento_cancelado' | 'treinamento_aprovador' | 'treinamento_integrante' | 'estagio_aprovador' | 'estagio_integrante' | 'ajuste_roles' | 'desligamento_compulsorio' | 'dados_desatualizados' | 'flyer_pendente';
  detalhe: string;
  data_ref: string;
  registro_id: number;
  detalhes_completos: MensalidadeDetalhes | AfastamentoDetalhes | DeltaDetalhes | EventoCanceladoDetalhes | TreinamentoAprovadorDetalhes | TreinamentoIntegranteDetalhes | EstagioAprovadorDetalhes | EstagioIntegranteDetalhes | AjusteRolesDetalhes | DesligamentoCompulsorioDetalhes | DadosDesatualizadosDetalhes | FlyerPendenteDetalhes;
}

export type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes, DeltaDetalhes, EventoCanceladoDetalhes, TreinamentoAprovadorDetalhes, TreinamentoIntegranteDetalhes, EstagioAprovadorDetalhes, EstagioIntegranteDetalhes, AjusteRolesDetalhes, DesligamentoCompulsorioDetalhes, DadosDesatualizadosDetalhes, FlyerPendenteDetalhes };

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
        
        const maiorAtrasoDias = Math.max(...entry.parcelas.map((p: any) => p.dias_atraso));
        const cargoGrauTexto = cargosMensalidadesMap.get(entry.registro_id) || null;
        
        todasPendencias.push({
          registro_id: entry.registro_id,
          nome_colete: entry.nome_colete,
          divisao_texto: entry.divisao_texto,
          tipo: 'mensalidade',
          detalhe: `${entry.parcelas.length} parcela(s) atrasada(s)`,
          data_ref: entry.mais_antiga,
          detalhes_completos: {
            cargo_grau_texto: cargoGrauTexto,
            total_parcelas: entry.parcelas.length,
            valor_total: entry.total_valor,
            parcelas: entry.parcelas,
            primeira_divida: entry.mais_antiga,
            ultima_divida: entry.mais_recente
          }
        });

        // Alerta de DESLIGAMENTO COMPULSÓRIO: 2+ parcelas E maior atraso >= 50 dias
        // Visível apenas para admin e regional (inclui adm_regional e diretor_regional)
        if (entry.parcelas.length >= 2 && maiorAtrasoDias >= 50 && (userRole === 'admin' || userRole === 'regional' || userRole === 'diretor_regional')) {
          todasPendencias.push({
            registro_id: entry.registro_id,
            nome_colete: entry.nome_colete,
            divisao_texto: entry.divisao_texto,
            tipo: 'desligamento_compulsorio',
            detalhe: `⚠️ ${entry.parcelas.length} parcelas - ${maiorAtrasoDias} dias de atraso`,
            data_ref: entry.mais_antiga,
            detalhes_completos: {
              cargo_grau_texto: cargoGrauTexto,
              total_parcelas: entry.parcelas.length,
              valor_total: entry.total_valor,
              maior_atraso_dias: maiorAtrasoDias,
              parcelas: entry.parcelas,
              primeira_divida: entry.mais_antiga,
              ultima_divida: entry.mais_recente
            } as DesligamentoCompulsorioDetalhes
          });
        }
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

        // 5.1 Pendências de Aprovação de Estágio (usando o mesmo meuIntegranteId)
        console.log('[usePendencias] Buscando pendências de estágio...');

        // Buscar solicitações de estágio em aprovação
        const { data: solicitacoesEstagio } = await supabase
          .from('solicitacoes_estagio')
          .select(`
            id, created_at,
            integrante:integrantes_portal!solicitacoes_estagio_integrante_id_fkey(
              id, nome_colete, divisao_texto, regional_texto, cargo_grau_texto
            ),
            cargo_estagio:cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome, grau)
          `)
          .eq('status', 'Em Aprovacao');

        // Buscar aprovações dessas solicitações de estágio
        const solicitacaoEstagioIds = solicitacoesEstagio?.map(s => s.id) || [];
        
        if (solicitacaoEstagioIds.length > 0) {
          const { data: aprovacoesEstagio } = await supabase
            .from('aprovacoes_estagio')
            .select('*')
            .in('solicitacao_id', solicitacaoEstagioIds);

          for (const sol of solicitacoesEstagio || []) {
            const integrante = sol.integrante as any;
            const cargoEstagio = sol.cargo_estagio as any;
            const aprovacoesDoSol = aprovacoesEstagio?.filter(a => a.solicitacao_id === sol.id) || [];
            
            // Verificar se realmente há aprovações pendentes antes de criar pendência
            const temAprovacoesPendentes = aprovacoesDoSol.some(a => a.status === 'pendente');
            if (!temAprovacoesPendentes) {
              // Todas as aprovações já foram concluídas, não deve aparecer como pendência
              continue;
            }
            
            // Verificar se o usuário é o integrante em estágio
            if (integrante?.id === meuIntegranteId) {
              // Buscar Diretor da Divisão do integrante
              const diretorDivisao = aprovacoesDoSol.find(a => a.nivel === 1);
              
              todasPendencias.push({
                registro_id: 0,
                nome_colete: 'Estágio aguardando aprovação',
                divisao_texto: integrante?.divisao_texto || '',
                tipo: 'estagio_integrante',
                detalhe: 'Seu estágio ainda não foi aprovado',
                data_ref: sol.created_at,
                detalhes_completos: {
                  solicitacao_id: sol.id,
                  cargo_estagio: cargoEstagio?.nome || 'N/A',
                  grau_estagio: cargoEstagio?.grau || 'N/A',
                  divisao_texto: integrante?.divisao_texto || 'N/A',
                  diretor_divisao_nome: diretorDivisao?.aprovador_nome_colete || 'N/A',
                  diretor_divisao_cargo: diretorDivisao?.aprovador_cargo || 'N/A',
                  created_at: sol.created_at
                }
              });
            }
            
            // Verificar se o usuário é um dos aprovadores
            const souAprovadorEstagio = aprovacoesDoSol.some(
              a => a.aprovador_integrante_id === meuIntegranteId
            );
            
            if (souAprovadorEstagio) {
              const aprovadoresPendentesEstagio = aprovacoesDoSol
                .filter(a => a.status === 'pendente')
                .map(a => a.aprovador_nome_colete || 'N/A');
              
              todasPendencias.push({
                registro_id: 0,
                nome_colete: 'Pendência de Aprovação de Estágio',
                divisao_texto: integrante?.divisao_texto || '',
                tipo: 'estagio_aprovador',
                detalhe: 'Aguardando aprovações',
                data_ref: sol.created_at,
                detalhes_completos: {
                  solicitacao_id: sol.id,
                  integrante_nome_colete: integrante?.nome_colete || 'N/A',
                  integrante_cargo_atual: integrante?.cargo_grau_texto || 'N/A',
                  cargo_estagio: cargoEstagio?.nome || 'N/A',
                  grau_estagio: cargoEstagio?.grau || 'N/A',
                  divisao_texto: integrante?.divisao_texto || 'N/A',
                  regional_texto: integrante?.regional_texto || 'N/A',
                  created_at: sol.created_at,
                  aprovadores_pendentes: aprovadoresPendentesEstagio
                }
              });
            }
          }
        }
        
        console.log('[usePendencias] Pendências de estágio encontradas:', 
          todasPendencias.filter(p => p.tipo === 'estagio_aprovador' || p.tipo === 'estagio_integrante').length);
      }

      // 5.2 Pendências de Flyer de Estágio
      // adm_regional vê flyers com status 'pendente', diretor_regional vê 'solicitado'
      if (userRole === 'admin' || userRole === 'regional') {
        console.log('[usePendencias] Buscando pendências de flyer de estágio...');

        // Verificar roles específicas do usuário para saber se é adm_regional ou diretor_regional
        const { data: userRolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        const userRolesList = userRolesData?.map(r => r.role) || [];
        const isAdmRegional = userRolesList.includes('adm_regional') || userRolesList.includes('comando') || userRole === 'admin';
        const isDiretorRegional = userRolesList.includes('diretor_regional') || userRolesList.includes('comando') || userRole === 'admin';

        // Buscar estágios ativos com flyer pendente ou solicitado
        const statusFlyerFiltro: string[] = [];
        if (isAdmRegional) statusFlyerFiltro.push('pendente');
        if (isDiretorRegional) statusFlyerFiltro.push('solicitado');

        if (statusFlyerFiltro.length > 0) {
          let queryFlyers = supabase
            .from('solicitacoes_estagio')
            .select(`
              id, status_flyer, grau_estagio, data_aprovacao,
              divisao_id, regional_id,
              integrantes_portal!solicitacoes_estagio_integrante_id_fkey(nome_colete, divisao_texto),
              cargos!solicitacoes_estagio_cargo_estagio_id_fkey(nome)
            `)
            .eq('status', 'Em Estagio')
            .in('status_flyer', statusFlyerFiltro);

          if (userRole === 'regional' && regionalId) {
            queryFlyers = queryFlyers.eq('regional_id', regionalId);
          }

          const { data: flyersSol, error: flyersError } = await queryFlyers;

          if (!flyersError && flyersSol) {
            for (const sol of flyersSol) {
              const integrante = sol.integrantes_portal as any;
              const cargoEstagio = sol.cargos as any;

              // Flyer pendente → pendência para adm_regional
              // Flyer solicitado → pendência para diretor_regional
              if (sol.status_flyer === 'pendente' && isAdmRegional) {
                todasPendencias.push({
                  registro_id: 0,
                  nome_colete: integrante?.nome_colete || 'N/A',
                  divisao_texto: integrante?.divisao_texto || '',
                  tipo: 'flyer_pendente',
                  detalhe: '🖼️ Solicitação de flyer pendente',
                  data_ref: sol.data_aprovacao || new Date().toISOString(),
                  detalhes_completos: {
                    solicitacao_id: sol.id,
                    integrante_nome_colete: integrante?.nome_colete || 'N/A',
                    cargo_estagio_nome: cargoEstagio?.nome || 'N/A',
                    grau_estagio: sol.grau_estagio,
                    divisao_texto: integrante?.divisao_texto || '',
                    status_flyer: sol.status_flyer,
                    data_aprovacao: sol.data_aprovacao,
                  } as FlyerPendenteDetalhes
                });
              }

              if (sol.status_flyer === 'solicitado' && isDiretorRegional) {
                todasPendencias.push({
                  registro_id: 0,
                  nome_colete: integrante?.nome_colete || 'N/A',
                  divisao_texto: integrante?.divisao_texto || '',
                  tipo: 'flyer_pendente',
                  detalhe: '📋 Flyer solicitado, aguardando conclusão',
                  data_ref: sol.data_aprovacao || new Date().toISOString(),
                  detalhes_completos: {
                    solicitacao_id: sol.id,
                    integrante_nome_colete: integrante?.nome_colete || 'N/A',
                    cargo_estagio_nome: cargoEstagio?.nome || 'N/A',
                    grau_estagio: sol.grau_estagio,
                    divisao_texto: integrante?.divisao_texto || '',
                    status_flyer: sol.status_flyer,
                    data_aprovacao: sol.data_aprovacao,
                  } as FlyerPendenteDetalhes
                });
              }
            }
          }

          console.log('[usePendencias] Pendências de flyer encontradas:',
            todasPendencias.filter(p => p.tipo === 'flyer_pendente').length);
        }
      }

      // 6. Pendências de Ajuste de Roles (apenas para admin)
      if (userRole === 'admin') {
        console.log('[usePendencias] Buscando pendências de ajuste de roles...');
        
        const { data: pendenciasRoles, error: errorRoles } = await supabase
          .from('pendencias_ajuste_roles')
          .select('*')
          .eq('status', 'pendente')
          .order('created_at', { ascending: false });

        if (!errorRoles && pendenciasRoles) {
          // Buscar nomes dos usuários que fizeram as alterações
          const alteradoPorIds = [...new Set(pendenciasRoles.map(p => p.alterado_por))];
          const nomesMap = new Map<string, string>();
          
          if (alteradoPorIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, nome_colete, name')
              .in('id', alteradoPorIds);
            
            profiles?.forEach(p => {
              nomesMap.set(p.id, p.nome_colete || p.name || 'Desconhecido');
            });
          }

          for (const pendencia of pendenciasRoles) {
            todasPendencias.push({
              registro_id: pendencia.integrante_registro_id,
              nome_colete: pendencia.integrante_nome_colete,
              divisao_texto: pendencia.integrante_divisao_texto,
              tipo: 'ajuste_roles',
              detalhe: `${pendencia.cargo_anterior || 'N/A'} → ${pendencia.cargo_novo}`,
              data_ref: pendencia.created_at,
              detalhes_completos: {
                id: pendencia.id,
                integrante_id: pendencia.integrante_id,
                cargo_anterior: pendencia.cargo_anterior,
                cargo_novo: pendencia.cargo_novo,
                grau_anterior: pendencia.grau_anterior,
                grau_novo: pendencia.grau_novo,
                alterado_por_nome: nomesMap.get(pendencia.alterado_por) || 'Desconhecido',
                justificativa: pendencia.justificativa,
                created_at: pendencia.created_at
              }
            });
          }
        }

        console.log('[usePendencias] Pendências de ajuste de roles encontradas:', 
          todasPendencias.filter(p => p.tipo === 'ajuste_roles').length);
      }

      // 8. Verificar dados desatualizados (> 7 dias)
      // Somente para roles que podem atualizar dados
      if (userRole === 'admin' || userRole === 'diretor_regional' || userRole === 'regional') {
        const LIMITE_DIAS = 7;
        const agora = new Date();
        const calcDias = (d: string | null) => {
          if (!d) return null;
          return Math.floor((agora.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
        };

        // Integrantes
        const { data: cargaInt } = await supabase
          .from('cargas_historico')
          .select('data_carga')
          .eq('tipo_carga', 'integrantes')
          .order('data_carga', { ascending: false })
          .limit(1);
        const diasInt = calcDias(cargaInt?.[0]?.data_carga || null);
        if (diasInt === null || diasInt > LIMITE_DIAS) {
          todasPendencias.push({
            nome_colete: 'Sistema',
            divisao_texto: 'Gestão ADM',
            tipo: 'dados_desatualizados',
            detalhe: diasInt !== null 
              ? `Dados de Integrantes não são atualizados há ${diasInt} dias` 
              : 'Dados de Integrantes nunca foram importados',
            data_ref: cargaInt?.[0]?.data_carga || new Date().toISOString(),
            registro_id: 0,
            detalhes_completos: {
              tipo_dado: 'integrantes',
              label: 'Integrantes',
              ultima_atualizacao: cargaInt?.[0]?.data_carga || null,
              dias_desde_atualizacao: diasInt,
            } as DadosDesatualizadosDetalhes
          });
        }

        // Inadimplência (mensalidades)
        const { data: cargaMens } = await supabase
          .from('mensalidades_atraso')
          .select('data_carga')
          .eq('ativo', true)
          .order('data_carga', { ascending: false })
          .limit(1);
        const diasMens = calcDias(cargaMens?.[0]?.data_carga || null);
        if (diasMens === null || diasMens > LIMITE_DIAS) {
          todasPendencias.push({
            nome_colete: 'Sistema',
            divisao_texto: 'Gestão ADM',
            tipo: 'dados_desatualizados',
            detalhe: diasMens !== null
              ? `Dados de Inadimplência não são atualizados há ${diasMens} dias`
              : 'Dados de Inadimplência nunca foram importados',
            data_ref: cargaMens?.[0]?.data_carga || new Date().toISOString(),
            registro_id: 0,
            detalhes_completos: {
              tipo_dado: 'inadimplencia',
              label: 'Inadimplência',
              ultima_atualizacao: cargaMens?.[0]?.data_carga || null,
              dias_desde_atualizacao: diasMens,
            } as DadosDesatualizadosDetalhes
          });
        }

        // Aniversariantes
        const { data: ultimoAniv } = await supabase
          .from('integrantes_portal')
          .select('updated_at')
          .not('data_nascimento', 'is', null)
          .eq('ativo', true)
          .order('updated_at', { ascending: false })
          .limit(1);
        const diasAniv = calcDias(ultimoAniv?.[0]?.updated_at || null);
        if (diasAniv === null || diasAniv > LIMITE_DIAS) {
          todasPendencias.push({
            nome_colete: 'Sistema',
            divisao_texto: 'Gestão ADM',
            tipo: 'dados_desatualizados',
            detalhe: diasAniv !== null
              ? `Dados de Aniversariantes não são atualizados há ${diasAniv} dias`
              : 'Dados de Aniversariantes nunca foram importados',
            data_ref: ultimoAniv?.[0]?.updated_at || new Date().toISOString(),
            registro_id: 0,
            detalhes_completos: {
              tipo_dado: 'aniversariantes',
              label: 'Aniversários',
              ultima_atualizacao: ultimoAniv?.[0]?.updated_at || null,
              dias_desde_atualizacao: diasAniv,
            } as DadosDesatualizadosDetalhes
          });
        }

        // Afastados
        const { data: cargaAfast } = await supabase
          .from('cargas_historico')
          .select('data_carga')
          .eq('tipo_carga', 'afastados')
          .order('data_carga', { ascending: false })
          .limit(1);
        const diasAfast = calcDias(cargaAfast?.[0]?.data_carga || null);
        if (diasAfast === null || diasAfast > LIMITE_DIAS) {
          todasPendencias.push({
            nome_colete: 'Sistema',
            divisao_texto: 'Gestão ADM',
            tipo: 'dados_desatualizados',
            detalhe: diasAfast !== null
              ? `Dados de Afastados não são atualizados há ${diasAfast} dias`
              : 'Dados de Afastados nunca foram importados',
            data_ref: cargaAfast?.[0]?.data_carga || new Date().toISOString(),
            registro_id: 0,
            detalhes_completos: {
              tipo_dado: 'afastados',
              label: 'Afastados',
              ultima_atualizacao: cargaAfast?.[0]?.data_carga || null,
              dias_desde_atualizacao: diasAfast,
            } as DadosDesatualizadosDetalhes
          });
        }
      }

      // Ordenar: desligamento_compulsorio primeiro, depois ajuste_roles, depois eventos cancelados, depois por data
      todasPendencias.sort((a, b) => {
        // Desligamento compulsório tem prioridade MÁXIMA
        if (a.tipo === 'desligamento_compulsorio' && b.tipo !== 'desligamento_compulsorio') return -1;
        if (b.tipo === 'desligamento_compulsorio' && a.tipo !== 'desligamento_compulsorio') return 1;
        
        // Pendências de ajuste de roles têm prioridade alta
        if (a.tipo === 'ajuste_roles' && b.tipo !== 'ajuste_roles') return -1;
        if (b.tipo === 'ajuste_roles' && a.tipo !== 'ajuste_roles') return 1;
        
        // Dados desatualizados têm prioridade alta
        if (a.tipo === 'dados_desatualizados' && b.tipo !== 'dados_desatualizados') return -1;
        if (b.tipo === 'dados_desatualizados' && a.tipo !== 'dados_desatualizados') return 1;
        
        // Eventos cancelados têm prioridade alta (mas menor que ajuste_roles)
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
