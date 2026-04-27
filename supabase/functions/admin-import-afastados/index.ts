import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { resolverEscopo } from '../_shared/escopo-grau.ts';

interface AfastadoInput {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  cargo_grau_texto: string | null;
  tipo_afastamento: string;
  data_afastamento: string;
  data_retorno_prevista: string;
  suspenso?: boolean;
  dias_suspensao?: number;
  observacao_auto?: string;
}

const normalizarTexto = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const normalizarDivisaoParaSalvar = (texto: string): string => {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  if (normalizado.includes('REGIONAL')) {
    normalizado = normalizado.replace(/^(DIVISAO\s+)?REGIONAL\s*/i, 'REGIONAL ');
  } else {
    if (!normalizado.startsWith('DIVISAO')) {
      normalizado = 'DIVISAO ' + normalizado.replace(/^DIVISAO\s*/i, '');
    }
  }
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  return normalizado;
};

const ROTA_OPERACAO = '/gestao-adm-afastamentos';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autenticado');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Usuário não autenticado');

    // Validar acesso via matriz de permissões da tela
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const isSystemAdmin = userRoles.includes('admin');

    const { data: screen } = await supabase
      .from('system_screens')
      .select('id')
      .eq('rota', ROTA_OPERACAO)
      .eq('ativo', true)
      .maybeSingle();

    if (screen) {
      const { data: permissions } = await supabase
        .from('screen_permissions')
        .select('role')
        .eq('screen_id', screen.id);
      const allowedRoles = (permissions || []).map((p: any) => p.role);
      const hasAccess = isSystemAdmin || userRoles.some((r: string) => allowedRoles.includes(r));
      if (!hasAccess) {
        console.warn('[admin-import-afastados] Acesso negado via matriz', { userRoles, allowedRoles });
        throw new Error('Permissão negada. Você não tem acesso para importar afastados.');
      }
      console.log('[admin-import-afastados] Acesso validado via matriz', { userRoles, allowedRoles });
    } else if (!isSystemAdmin) {
      throw new Error('Acesso negado - tela não configurada');
    }

    const { afastados, observacoes, permitir_vazio, skip_deltas, user_grau, user_regional_id, user_divisao_id } = await req.json() as {
      afastados: AfastadoInput[],
      observacoes?: string,
      permitir_vazio?: boolean,
      skip_deltas?: boolean,
      user_grau?: string | null,
      user_regional_id?: string | null,
      user_divisao_id?: string | null,
    };

    // Resolver escopo (lança se Grau V/VI sem ID)
    let escopo;
    try {
      escopo = resolverEscopo({ user_grau, user_regional_id, user_divisao_id });
    } catch (e: any) {
      return new Response(
        JSON.stringify({ sucesso: false, error: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[admin-import-afastados] Escopo resolvido:`, escopo);

    // Buscar afastados ativos atuais (FILTRADOS POR ESCOPO)
    let queryAtuais = supabase
      .from('integrantes_afastados')
      .select('id, registro_id, nome_colete, divisao_texto, cargo_grau_texto, divisao_id')
      .eq('ativo', true);

    if (escopo.tipo === 'divisao' && escopo.divisao_id) {
      queryAtuais = queryAtuais.eq('divisao_id', escopo.divisao_id);
    } else if (escopo.tipo === 'regional' && escopo.regional_id) {
      // Para Grau V: pegar divisões da regional e filtrar
      const { data: divisoesRegional } = await supabase
        .from('divisoes')
        .select('id')
        .eq('regional_id', escopo.regional_id);
      const divisaoIds = (divisoesRegional || []).map(d => d.id);
      if (divisaoIds.length > 0) {
        queryAtuais = queryAtuais.in('divisao_id', divisaoIds);
      }
    }

    const { data: afastadosAtuais } = await queryAtuais;
    console.log(`[admin-import-afastados] Afastados ativos no escopo: ${afastadosAtuais?.length || 0}`);

    // Arquivo vazio com permitir_vazio = baixa em todos
    if ((!afastados || afastados.length === 0) && permitir_vazio) {
      console.log(`[admin-import-afastados] Arquivo vazio - dando baixa em ${afastadosAtuais?.length || 0} afastados`);
      
      const hoje = new Date().toISOString().split('T')[0];
      let baixas = 0;

      // Criar registro em cargas_historico
      const { data: cargaHistorico, error: cargaError } = await supabase
        .from('cargas_historico')
        .insert({
          dados_snapshot: { afastados: [], baixa_total: true },
          total_integrantes: 0,
          tipo_carga: 'afastados',
          observacoes: observacoes || 'Baixa total - arquivo vazio',
          realizado_por: user.email || user.id,
        })
        .select()
        .single();

      if (cargaError) throw new Error('Erro ao registrar histórico de carga');

      if (afastadosAtuais && afastadosAtuais.length > 0) {
        for (const atual of afastadosAtuais) {
          const { error } = await supabase
            .from('integrantes_afastados')
            .update({
              data_retorno_efetivo: hoje,
              ativo: false,
              motivo_baixa: 'retornou',
              observacoes_baixa: 'Baixa automática - arquivo vazio (todos retornaram)',
              carga_historico_id: cargaHistorico.id,
            })
            .eq('id', atual.id);

          if (!error) baixas++;
        }
      }

      return new Response(JSON.stringify({
        sucesso: true,
        total: 0,
        novos: 0,
        atualizados: 0,
        baixas_automaticas: baixas,
        avisos: [],
        carga_id: cargaHistorico.id,
        deltasGerados: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!afastados || !Array.isArray(afastados) || afastados.length === 0) {
      throw new Error('Nenhum afastado para processar');
    }

    console.log(`[admin-import-afastados] Iniciando importação de ${afastados.length} afastados`);

    // FILTRO POR ESCOPO: para Grau V/VI, restringir lista de afastados ao escopo do usuário.
    let afastadosNoEscopo = afastados;
    let afastadosForaEscopo: AfastadoInput[] = [];
    if (escopo.tipo !== 'comando') {
      const registroIds = afastados.map(a => a.registro_id);
      const { data: integrantesScope } = await supabase
        .from('integrantes_portal')
        .select('registro_id, divisao_id, regional_id')
        .in('registro_id', registroIds);
      const mapaRegistro = new Map<number, { divisao_id: string | null; regional_id: string | null }>();
      (integrantesScope || []).forEach(i => mapaRegistro.set(i.registro_id, {
        divisao_id: i.divisao_id, regional_id: i.regional_id
      }));

      afastadosNoEscopo = [];
      for (const a of afastados) {
        const m = mapaRegistro.get(a.registro_id);
        const dentro = escopo.tipo === 'divisao'
          ? m?.divisao_id === escopo.divisao_id
          : m?.regional_id === escopo.regional_id;
        if (dentro) afastadosNoEscopo.push(a);
        else afastadosForaEscopo.push(a);
      }
      console.log(`[admin-import-afastados] Afastados no escopo: ${afastadosNoEscopo.length} | fora: ${afastadosForaEscopo.length}`);
    }

    let novos = 0;
    let atualizados = 0;
    let baixasAutomaticas = 0;
    const avisos: string[] = afastadosForaEscopo.map(a =>
      `Ignorado por escopo (${escopo.tipo}): ${a.nome_colete} (${a.registro_id})`
    );
    const deltasPendentes: any[] = [];

    const registrosNovaPlanilha = new Set(afastadosNoEscopo.map(a => a.registro_id));
    const registrosAtuais = new Set(afastadosAtuais?.map(a => a.registro_id) || []);
    const hoje = new Date().toISOString().split('T')[0];

    // Criar registro em cargas_historico
    const { data: cargaHistorico, error: cargaError } = await supabase
      .from('cargas_historico')
      .insert({
        dados_snapshot: { afastados },
        total_integrantes: afastados.length,
        tipo_carga: 'afastados',
        observacoes: observacoes || 'Carga de Integrantes Afastados Temporariamente',
        realizado_por: user.email || user.id,
      })
      .select()
      .single();

    if (cargaError) throw new Error('Erro ao registrar histórico de carga');

    // Baixa automática: quem sumiu da planilha
    if (afastadosAtuais) {
      for (const atual of afastadosAtuais) {
        if (!registrosNovaPlanilha.has(atual.registro_id)) {
          console.log(`[BAIXA_AUTO] ${atual.nome_colete} (${atual.registro_id}) não está mais na planilha`);
          
          const { error } = await supabase
            .from('integrantes_afastados')
            .update({
              data_retorno_efetivo: hoje,
              ativo: false,
              motivo_baixa: 'retornou',
              observacoes_baixa: 'Baixa automática - não consta mais na planilha de afastados',
              carga_historico_id: cargaHistorico.id,
            })
            .eq('id', atual.id);

          if (!error) {
            baixasAutomaticas++;
          } else {
            avisos.push(`Erro ao dar baixa em ${atual.nome_colete}`);
          }
        }
      }
    }

    // Detectar novos afastados (para deltas)
    afastadosNoEscopo.forEach(novo => {
      if (!registrosAtuais.has(novo.registro_id)) {
        deltasPendentes.push({
          registro_id: novo.registro_id,
          nome_colete: novo.nome_colete,
          divisao_texto: novo.divisao_texto,
          cargo_grau_texto: novo.cargo_grau_texto,
          tipo_delta: 'NOVO_AFASTADOS',
          prioridade: 0,
          dados_adicionais: {
            tipo_afastamento: novo.tipo_afastamento,
            data_afastamento: novo.data_afastamento
          }
        });
      }
    });

    // Processar cada afastado (inserir/atualizar)
    for (const afastado of afastadosNoEscopo) {
      try {
        const { data: existente } = await supabase
          .from('integrantes_afastados')
          .select('id')
          .eq('registro_id', afastado.registro_id)
          .eq('ativo', true)
          .maybeSingle();

        // Buscar divisao_id via integrantes_portal ou via texto
        let divisao_id: string | null = null;
        const { data: integrantePortal } = await supabase
          .from('integrantes_portal')
          .select('divisao_id')
          .eq('registro_id', afastado.registro_id)
          .maybeSingle();
        
        if (integrantePortal?.divisao_id) {
          divisao_id = integrantePortal.divisao_id;
        } else {
          // Fallback: buscar divisão pelo texto normalizado
          const divisaoNorm = normalizarDivisaoParaSalvar(afastado.divisao_texto);
          const { data: divisaoMatch } = await supabase
            .from('divisoes')
            .select('id')
            .ilike('nome', divisaoNorm.replace(/^DIVISAO\s*/i, '').replace(/\s*-\s*SP$/i, '').trim())
            .maybeSingle();
          if (divisaoMatch) divisao_id = divisaoMatch.id;
        }

        const afastadoData = {
          registro_id: afastado.registro_id,
          nome_colete: afastado.nome_colete,
          divisao_texto: normalizarDivisaoParaSalvar(afastado.divisao_texto),
          divisao_id,
          cargo_grau_texto: afastado.cargo_grau_texto,
          tipo_afastamento: afastado.tipo_afastamento,
          data_afastamento: afastado.data_afastamento,
          data_retorno_prevista: afastado.data_retorno_prevista,
          ativo: true,
          carga_historico_id: cargaHistorico.id,
          observacoes: afastado.observacao_auto || null,
        };

        if (existente) {
          const { error } = await supabase
            .from('integrantes_afastados')
            .update(afastadoData)
            .eq('id', existente.id);
          if (error) {
            avisos.push(`Erro ao atualizar ${afastado.nome_colete}`);
          } else {
            atualizados++;
          }
        } else {
          const { error } = await supabase
            .from('integrantes_afastados')
            .insert(afastadoData);
          if (error) {
            avisos.push(`Erro ao inserir ${afastado.nome_colete}`);
          } else {
            novos++;
          }
        }

        // Verificar se integrante existe no portal
        const { data: integranteCheck } = await supabase
          .from('integrantes_portal')
          .select('id')
          .eq('registro_id', afastado.registro_id)
          .maybeSingle();

        if (!integranteCheck) {
          avisos.push(`${afastado.nome_colete} (${afastado.registro_id}) não encontrado em integrantes_portal`);
        }
      } catch (error) {
        avisos.push(`Erro ao processar ${afastado.nome_colete}`);
      }
    }

    // Salvar deltas (skip se chamado pela Gestão ADM)
    if (deltasPendentes.length > 0 && !skip_deltas) {
      for (const delta of deltasPendentes) {
        await supabase
          .from('deltas_pendentes')
          .insert({
            ...delta,
            carga_id: cargaHistorico.id,
            status: 'PENDENTE'
          });
      }
    }

    const resultado = {
      sucesso: true,
      total: afastadosNoEscopo.length,
      novos,
      atualizados,
      baixas_automaticas: baixasAutomaticas,
      avisos,
      carga_id: cargaHistorico.id,
      deltasGerados: deltasPendentes.length,
      deltas: deltasPendentes.slice(0, 5),
    };

    console.log('[admin-import-afastados] Importação concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-import-afastados] Erro:', error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
