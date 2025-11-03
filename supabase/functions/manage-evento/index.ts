import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[manage-evento] Requisição recebida');
    
    const { 
      evento_id, 
      titulo, 
      data_evento, 
      regional_id, 
      divisao_id, 
      tipo_evento,
      user_id 
    } = await req.json();
    
    console.log('[manage-evento] Dados recebidos:', { 
      evento_id, 
      titulo, 
      data_evento, 
      regional_id, 
      divisao_id, 
      tipo_evento,
      user_id 
    });

    if (!evento_id || !titulo || !data_evento || !user_id) {
      console.error('[manage-evento] Parâmetros obrigatórios faltando');
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: evento_id, titulo, data_evento, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service_role para bypassar RLS
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

    console.log('[manage-evento] Verificando se usuário tem permissão...');

    // Verificar se o user_id tem role admin ou moderator
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id);

    if (rolesError) {
      console.error('[manage-evento] Erro ao buscar roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-evento] Roles encontradas:', userRoles);

    const hasPermission = userRoles?.some(r => r.role === 'admin' || r.role === 'moderator');

    if (!hasPermission) {
      console.error('[manage-evento] Usuário não tem permissão');
      return new Response(
        JSON.stringify({ error: 'Apenas administradores e moderadores podem criar eventos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-evento] Usuário tem permissão, criando evento...');

    // Criar evento
    const { data, error } = await supabaseAdmin
      .from('eventos_agenda')
      .insert({
        evento_id,
        titulo,
        data_evento,
        regional_id,
        divisao_id,
        tipo_evento,
      })
      .select()
      .single();

    if (error) {
      console.error('[manage-evento] Erro ao criar evento:', error);
      return new Response(
        JSON.stringify({ error: `Erro ao criar evento: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-evento] Evento criado com sucesso:', data);
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[manage-evento] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
