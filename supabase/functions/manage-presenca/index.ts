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
      action, // 'add' ou 'remove'
      firebase_uid,
      evento_agenda_id,
      integrante_id,
      profile_id,
      presenca_id, // Para remover
    } = await req.json();

    console.log('[manage-presenca] Recebido:', { action, firebase_uid, evento_agenda_id, integrante_id });

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

    if (action === 'remove' && !presenca_id) {
      return new Response(
        JSON.stringify({ error: 'presenca_id é obrigatório para remover' }),
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
    if (action === 'add') {
      console.log('[manage-presenca] Adicionando presença...');
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .insert({
          evento_agenda_id,
          integrante_id,
          profile_id: profile_id || null,
          confirmado_por: user_id,
        })
        .select()
        .single();

      if (error) {
        console.error('[manage-presenca] Erro ao adicionar:', error);
        // Tratar duplicata
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'Presença já registrada' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Erro ao adicionar presença' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-presenca] Presença adicionada:', data);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove') {
      console.log('[manage-presenca] Removendo presença...');
      const { error } = await supabaseAdmin
        .from('presencas')
        .delete()
        .eq('id', presenca_id);

      if (error) {
        console.error('[manage-presenca] Erro ao remover:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao remover presença' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-presenca] Presença removida');
      return new Response(
        JSON.stringify({ success: true }),
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