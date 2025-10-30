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
    console.log('[admin-import-integrantes] Request received');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { admin_user_id, novos, atualizados } = await req.json();

    console.log('[admin-import-integrantes] Validating admin:', admin_user_id);
    console.log('[admin-import-integrantes] Novos:', novos?.length || 0);
    console.log('[admin-import-integrantes] Atualizados:', atualizados?.length || 0);

    // Validate required parameters
    if (!admin_user_id) {
      return new Response(
        JSON.stringify({ error: 'admin_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id);

    if (roleError) {
      console.error('[admin-import-integrantes] Error checking roles:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error checking admin role', details: roleError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdminRole = roles?.some((r: any) => r.role === 'admin');
    
    if (!hasAdminRole) {
      console.warn('[admin-import-integrantes] User does not have admin role:', admin_user_id);
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilegios de admin necessarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-import-integrantes] Admin validated successfully');

    let insertedCount = 0;
    let updatedCount = 0;

    // Insert new integrantes
    if (novos && novos.length > 0) {
      console.log('[admin-import-integrantes] Inserting novos:', novos.length);
      
      const { error: insertError } = await supabase
        .from('integrantes_portal')
        .insert(novos);

      if (insertError) {
        console.error('[admin-import-integrantes] Error inserting:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao inserir novos integrantes', details: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedCount = novos.length;
    }

    // Update existing integrantes
    if (atualizados && atualizados.length > 0) {
      console.log('[admin-import-integrantes] Updating atualizados:', atualizados.length);
      
      for (const update of atualizados) {
        const { id, ...updateData } = update;
        
        const { error: updateError } = await supabase
          .from('integrantes_portal')
          .update(updateData)
          .eq('id', id);

        if (updateError) {
          console.error('[admin-import-integrantes] Error updating:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar integrante', details: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        updatedCount++;
      }
    }

    console.log('[admin-import-integrantes] Success - Inserted:', insertedCount, 'Updated:', updatedCount);

    return new Response(
      JSON.stringify({ 
        success: true, 
        insertedCount, 
        updatedCount,
        message: `${insertedCount} novos, ${updatedCount} atualizados` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-import-integrantes] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
