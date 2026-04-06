import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

const ALLOWED_ROLES = ['admin', 'comando', 'adm_regional', 'diretor_regional', 'diretor_divisao'];

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

    // Verificar se tem alguma role permitida
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ALLOWED_ROLES);

    if (!roles || roles.length === 0) {
      throw new Error('Permissão negada. Você não tem acesso para importar afastados.');
    }

    const { afastados, observacoes, permitir_vazio } = await req.json() as {
      afastados: AfastadoInput[],
      observacoes?: string,
      permitir_vazio?: boolean,
    };

    // Buscar afastados ativos atuais
    const { data: afastadosAtuais } = await supabase
      .from('integrantes_afastados')
      .select('id, registro_id, nome_colete, divisao_texto, cargo_grau_texto')
      .eq('ativo', true);

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

    let novos = 0;
    let atualizados = 0;
    let baixasAutomaticas = 0;
    const avisos: string[] = [];
    const deltasPendentes: any[] = [];

    const registrosNovaPlanilha = new Set(afastados.map(a => a.registro_id));
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
    afastados.forEach(novo => {
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
    for (const afastado of afastados) {
      try {
        const { data: existente } = await supabase
          .from('integrantes_afastados')
          .select('id')
          .eq('registro_id', afastado.registro_id)
          .eq('ativo', true)
          .maybeSingle();

        const afastadoData = {
          registro_id: afastado.registro_id,
          nome_colete: afastado.nome_colete,
          divisao_texto: normalizarDivisaoParaSalvar(afastado.divisao_texto),
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
        const { data: integrantePortal } = await supabase
          .from('integrantes_portal')
          .select('id')
          .eq('registro_id', afastado.registro_id)
          .maybeSingle();

        if (!integrantePortal) {
          avisos.push(`${afastado.nome_colete} (${afastado.registro_id}) não encontrado em integrantes_portal`);
        }
      } catch (error) {
        avisos.push(`Erro ao processar ${afastado.nome_colete}`);
      }
    }

    // Salvar deltas
    if (deltasPendentes.length > 0) {
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
      total: afastados.length,
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
