import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { logError } from '../_shared/error-handler.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      action: z.enum(['add', 'remove'], { errorMap: () => ({ message: 'Ação deve ser "add" ou "remove"' }) }),
      screen_id: z.string().uuid('ID de tela inválido'),
      role: z.enum(['admin', 'moderator', 'user', 'diretor_regional', 'diretor_divisao', 'regional', 'social_divisao', 'adm_divisao']),
      user_id: z.string().uuid('ID de usuário inválido')
    });

    const { action, screen_id, role, user_id } = requestSchema.parse(await req.json());

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

    // Verificar se o user_id tem role admin
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id);

    if (rolesError) {
      logError('manage-screen-permissions', rolesError, { user_id });
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
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
        logError('manage-screen-permissions', error, { screen_id, role });
        return new Response(
          JSON.stringify({ error: 'Erro ao adicionar permissão' }),
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
        logError('manage-screen-permissions', error, { screen_id, role });
        return new Response(
          JSON.stringify({ error: 'Erro ao remover permissão' }),
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
    if (error instanceof z.ZodError) {
      logError('manage-screen-permissions', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('manage-screen-permissions', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
