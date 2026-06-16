import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { resolverEscopo } from '../_shared/escopo-grau.ts';

interface DesligadoInput {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  cargo_grau_texto: string;
  cargo_nome: string | null;
  grau: string | null;
  tipo_label: string;
  motivo_inativacao: 'desligado' | 'expulso';
  data_desligamento: string;
  data_inferida?: boolean;
}

const normalizarTexto = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

// Nome "limpo" da divisão para casar com divisoes.nome (que é "DIVISAO X - SP")
const divisaoNomeCompleto = (texto: string): string => {
  let n = normalizarTexto(texto);
  n = n.replace(/^DIVISAO\s*/i, '').replace(/^REGIONAL\s*/i, '').replace(/\s*-\s*SP\s*$/i, '').trim();
  return n;
};

const ROTA_OPERACAO = '/gestao-adm-desligados';

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

    // Validar acesso via matriz de permissões
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const isSystemAdmin = userRoles.includes('admin');

    const { data: screen } = await supabase
      .from('system_screens').select('id').eq('rota', ROTA_OPERACAO).eq('ativo', true).maybeSingle();

    if (screen) {
      const { data: permissions } = await supabase
        .from('screen_permissions').select('role').eq('screen_id', screen.id);
      const allowedRoles = (permissions || []).map((p: any) => p.role);
      const hasAccess = isSystemAdmin || userRoles.some((r: string) => allowedRoles.includes(r));
      if (!hasAccess) throw new Error('Permissão negada. Você não tem acesso para importar desligados.');
    } else if (!isSystemAdmin) {
      throw new Error('Acesso negado - tela não configurada');
    }

    const { desligados, observacoes, user_grau, user_regional_id, user_divisao_id } = await req.json() as {
      desligados: DesligadoInput[];
      observacoes?: string;
      user_grau?: string | null;
      user_regional_id?: string | null;
      user_divisao_id?: string | null;
    };

    if (!desligados || !Array.isArray(desligados) || desligados.length === 0) {
      throw new Error('Nenhum desligado para processar');
    }

    let escopo;
    try {
      escopo = resolverEscopo({ user_grau, user_regional_id, user_divisao_id });
    } catch (e: any) {
      return new Response(JSON.stringify({ sucesso: false, error: e.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[admin-import-desligados] Escopo:', escopo);

    // Carregar divisões (com regional/comando) para resolver IDs e textos
    const { data: divisoes } = await supabase
      .from('divisoes')
      .select('id, nome, regional_id, regionais:regional_id ( nome, comando_id, comandos:comando_id ( nome ) )');

    const mapaDivisao = new Map<string, any>();
    (divisoes || []).forEach((d: any) => {
      mapaDivisao.set(divisaoNomeCompleto(d.nome), d);
    });

    // Registrar carga
    const { data: cargaHistorico, error: cargaError } = await supabase
      .from('cargas_historico')
      .insert({
        dados_snapshot: { desligados },
        total_integrantes: desligados.length,
        tipo_carga: 'desligados',
        observacoes: observacoes || 'Carga de Integrantes Desligados Definitivamente',
        realizado_por: user.email || user.id,
      })
      .select().single();
    if (cargaError) throw new Error('Erro ao registrar histórico de carga');

    let inseridos = 0;
    let atualizados = 0;
    const ignorados: { registro_id: number; nome_colete: string; motivo: string }[] = [];

    for (const d of desligados) {
      try {
        const chaveDiv = divisaoNomeCompleto(d.divisao_texto);
        const div = mapaDivisao.get(chaveDiv);
        if (!div) {
          ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: `Divisão não encontrada na base: "${d.divisao_texto}"` });
          continue;
        }

        // Escopo
        if (escopo.tipo === 'divisao' && div.id !== escopo.divisao_id) {
          ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: 'Fora da sua divisão (escopo)' });
          continue;
        }
        if (escopo.tipo === 'regional' && div.regional_id !== escopo.regional_id) {
          ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: 'Fora da sua regional (escopo)' });
          continue;
        }

        const regionalTexto = div.regionais?.nome || '';
        const comandoTexto = div.regionais?.comandos?.nome || 'COMANDO';

        // Verificar conflito com registro ativo
        const { data: existente } = await supabase
          .from('integrantes_portal')
          .select('id, ativo')
          .eq('registro_id', d.registro_id)
          .maybeSingle();

        if (existente && existente.ativo === true) {
          ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: 'Consta como ATIVO no portal — ignorado para evitar conflito' });
          continue;
        }

        const payload: any = {
          registro_id: d.registro_id,
          nome_colete: d.nome_colete,
          comando_texto: comandoTexto,
          regional_texto: regionalTexto,
          divisao_texto: div.nome,
          divisao_id: div.id,
          regional_id: div.regional_id,
          cargo_grau_texto: d.cargo_grau_texto || 'Sem Cargo',
          cargo_nome: d.cargo_nome,
          grau: d.grau,
          ativo: false,
          motivo_inativacao: d.motivo_inativacao,
          data_inativacao: new Date(`${d.data_desligamento}T12:00:00-03:00`).toISOString(),
          observacoes: d.data_inferida
            ? `${d.tipo_label} (data estimada). Carga de desligados.`
            : `${d.tipo_label}. Carga de desligados.`,
        };

        if (existente) {
          const { error } = await supabase.from('integrantes_portal').update(payload).eq('id', existente.id);
          if (error) {
            ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: `Erro ao atualizar: ${error.message}` });
          } else {
            atualizados++;
          }
        } else {
          const { error } = await supabase.from('integrantes_portal').insert(payload);
          if (error) {
            ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: `Erro ao inserir: ${error.message}` });
          } else {
            inseridos++;
          }
        }
      } catch (e: any) {
        ignorados.push({ registro_id: d.registro_id, nome_colete: d.nome_colete, motivo: `Erro inesperado: ${e.message}` });
      }
    }

    const resultado = {
      sucesso: true,
      total: desligados.length,
      inseridos,
      atualizados,
      ignorados_count: ignorados.length,
      ignorados,
      carga_id: cargaHistorico.id,
    };
    console.log('[admin-import-desligados] Concluído:', { inseridos, atualizados, ignorados: ignorados.length });

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-import-desligados] Erro:', error);
    return new Response(JSON.stringify({ sucesso: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
