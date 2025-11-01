import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, // 'initialize', 'add' ou 'remove'
      firebase_uid,
      evento_agenda_id,
      integrante_id,
      profile_id,
      divisao_id, // Para initialize
    } = await req.json();

    console.log('[manage-presenca] Recebido:', { action, firebase_uid, evento_agenda_id, integrante_id, divisao_id });

    // Validar campos obrigatórios
    if (!action || !firebase_uid) {
      return new Response(
        JSON.stringify({ error: 'action e firebase_uid são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add' && (!evento_agenda_id || !integrante_id)) {
      return new Response(
        JSON.stringify({ error: 'evento_agenda_id e integrante_id são obrigatórios para adicionar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove' && (!evento_agenda_id || !integrante_id)) {
      return new Response(
        JSON.stringify({ error: 'evento_agenda_id e integrante_id são obrigatórios para remover' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'initialize' && (!evento_agenda_id || !divisao_id)) {
      return new Response(
        JSON.stringify({ error: 'evento_agenda_id e divisao_id são obrigatórios para inicializar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role (bypassa RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Buscar user_id no profiles usando firebase_uid
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', firebase_uid)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[manage-presenca] Erro ao buscar profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = profile.id;
    console.log('[manage-presenca] user_id encontrado:', user_id);

    // Verificar se o usuário tem role de admin ou moderator
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id);

    if (rolesError) {
      console.error('[manage-presenca] Erro ao buscar roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roles = userRoles?.map(r => r.role) || [];
    console.log('[manage-presenca] Roles do usuário:', roles);

    const isAuthorized = roles.includes('admin') || roles.includes('moderator');

    if (!isAuthorized) {
      console.log('[manage-presenca] Usuário não autorizado');
      return new Response(
        JSON.stringify({ error: 'Sem permissão para gerenciar presenças' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar ação
    if (action === 'initialize') {
      console.log('[manage-presenca] Inicializando lista de presença...');
      
      // Buscar nome da divisão
      const { data: divisao, error: divisaoError } = await supabaseAdmin
        .from('divisoes')
        .select('nome')
        .eq('id', divisao_id)
        .single();
      
      if (divisaoError || !divisao) {
        console.error('[manage-presenca] Erro ao buscar divisão:', divisaoError);
        return new Response(
          JSON.stringify({ error: 'Divisão não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Função para remover acentos e normalizar texto
      const normalizeText = (text: string) => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      };
      
      // Buscar TODOS os integrantes ativos
      const { data: allIntegrantes, error: integrantesError } = await supabaseAdmin
        .from('integrantes_portal')
        .select('id, profile_id, divisao_texto')
        .eq('ativo', true);
      
      if (integrantesError) {
        console.error('[manage-presenca] Erro ao buscar integrantes:', integrantesError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar integrantes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Filtrar integrantes da divisão usando normalização
      const divisaoNormalizada = normalizeText(divisao.nome);
      const integrantes = (allIntegrantes || []).filter(i => {
        const divisaoIntegranteNormalizada = normalizeText(i.divisao_texto || '');
        return divisaoIntegranteNormalizada.includes(divisaoNormalizada) ||
               divisaoNormalizada.includes(divisaoIntegranteNormalizada);
      });
      
      console.log('[manage-presenca] Divisão normalizada:', divisaoNormalizada);
      console.log('[manage-presenca] Integrantes encontrados:', integrantes.length);
      
      if (integrantes.length === 0) {
        console.log('[manage-presenca] Nenhum integrante encontrado para esta divisão');
        return new Response(
          JSON.stringify({ success: true, count: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Criar registros de presença com status='ausente'
      const presencasParaInserir = integrantes.map(i => ({
        evento_agenda_id,
        integrante_id: i.id,
        profile_id: i.profile_id || null,
        status: 'ausente',
        confirmado_por: user_id,
      }));
      
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .insert(presencasParaInserir)
        .select();
      
      if (error) {
        console.error('[manage-presenca] Erro ao inicializar:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao inicializar lista' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[manage-presenca] ${data.length} registros criados`);
      return new Response(
        JSON.stringify({ success: true, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add') {
      console.log('[manage-presenca] Adicionando presença...');
      
      // Verificar se já existe registro
      const { data: existente } = await supabaseAdmin
        .from('presencas')
        .select('id, status')
        .eq('evento_agenda_id', evento_agenda_id)
        .eq('integrante_id', integrante_id)
        .maybeSingle();
      
      if (existente) {
        // Atualizar status para 'presente'
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .update({ 
            status: 'presente',
            confirmado_em: new Date().toISOString(),
            confirmado_por: user_id,
          })
          .eq('id', existente.id)
          .select()
          .single();
        
        if (error) {
          console.error('[manage-presenca] Erro ao atualizar:', error);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar presença' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[manage-presenca] Presença atualizada para presente');
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Inserir novo registro com status 'visitante'
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .insert({
            evento_agenda_id,
            integrante_id,
            profile_id: profile_id || null,
            status: 'visitante',
            confirmado_por: user_id,
          })
          .select()
          .single();
        
        if (error) {
          console.error('[manage-presenca] Erro ao inserir:', error);
          return new Response(
            JSON.stringify({ error: 'Erro ao adicionar visitante' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[manage-presenca] Visitante adicionado');
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'remove') {
      console.log('[manage-presenca] Marcando como ausente...');
      
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .update({ 
          status: 'ausente',
          confirmado_em: new Date().toISOString(),
          confirmado_por: user_id,
        })
        .eq('evento_agenda_id', evento_agenda_id)
        .eq('integrante_id', integrante_id)
        .select()
        .single();
      
      if (error) {
        console.error('[manage-presenca] Erro ao marcar ausente:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao marcar como ausente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[manage-presenca] Marcado como ausente');
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[manage-presenca] Erro:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});