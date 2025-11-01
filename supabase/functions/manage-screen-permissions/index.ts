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
    console.log('[manage-screen-permissions] Requisição recebida');
    
    const { action, screen_id, role, firebase_uid } = await req.json();
    
    console.log('[manage-screen-permissions] Dados recebidos:', { 
      action, 
      screen_id, 
      role, 
      firebase_uid 
    });

    if (!action || !screen_id || !role || !firebase_uid) {
      console.error('[manage-screen-permissions] Parâmetros faltando');
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: action, screen_id, role, firebase_uid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      console.error('[manage-screen-permissions] Ação inválida:', action);
      return new Response(
        JSON.stringify({ error: 'Ação deve ser "add" ou "remove"' }),
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

    console.log('[manage-screen-permissions] Verificando se usuário é admin...');

    // Verificar se o firebase_uid tem role admin
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', firebase_uid);

    if (rolesError) {
      console.error('[manage-screen-permissions] Erro ao buscar roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-screen-permissions] Roles encontradas:', userRoles);

    const isAdmin = userRoles?.some(r => r.role === 'admin');

    if (!isAdmin) {
      console.error('[manage-screen-permissions] Usuário não é admin');
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem gerenciar permissões' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-screen-permissions] Usuário é admin, prosseguindo com ação:', action);

    if (action === 'add') {
      // Adicionar permissão
      console.log('[manage-screen-permissions] Inserindo permissão...');
      const { data, error } = await supabaseAdmin
        .from('screen_permissions')
        .insert({ screen_id, role })
        .select()
        .single();

      if (error) {
        console.error('[manage-screen-permissions] Erro ao adicionar permissão:', error);
        return new Response(
          JSON.stringify({ error: `Erro ao adicionar permissão: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-screen-permissions] Permissão adicionada com sucesso:', data);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Remover permissão
      console.log('[manage-screen-permissions] Buscando permissão existente para remover...');
      const { data: existing, error: findError } = await supabaseAdmin
        .from('screen_permissions')
        .select('id')
        .eq('screen_id', screen_id)
        .eq('role', role)
        .single();

      if (findError || !existing) {
        console.error('[manage-screen-permissions] Permissão não encontrada:', findError);
        return new Response(
          JSON.stringify({ error: 'Permissão não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-screen-permissions] Removendo permissão:', existing.id);
      const { error } = await supabaseAdmin
        .from('screen_permissions')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('[manage-screen-permissions] Erro ao remover permissão:', error);
        return new Response(
          JSON.stringify({ error: `Erro ao remover permissão: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-screen-permissions] Permissão removida com sucesso');
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[manage-screen-permissions] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
