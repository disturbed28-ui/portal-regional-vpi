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

    // Upsert new integrantes (insert or update if registro_id exists)
    if (novos && novos.length > 0) {
      // Filter out any records with null/undefined registro_id
      const validNovos = novos.filter((item: any) => item.registro_id != null);
      
      console.log('[admin-import-integrantes] Total novos received:', novos.length);
      console.log('[admin-import-integrantes] Valid novos (non-null registro_id):', validNovos.length);
      
      // Deduplicate by registro_id (keep last occurrence)
      const seenIds = new Set();
      const uniqueNovos = [];
      const duplicates = [];
      
      for (const item of validNovos) {
        if (seenIds.has(item.registro_id)) {
          duplicates.push(item.registro_id);
        } else {
          seenIds.add(item.registro_id);
          uniqueNovos.push(item);
        }
      }
      
      if (duplicates.length > 0) {
        console.log('[admin-import-integrantes] Duplicate registro_ids found:', duplicates);
      }
      
      console.log('[admin-import-integrantes] Unique novos after dedup:', uniqueNovos.length);
      
      const { error: upsertError } = await supabase
        .from('integrantes_portal')
        .upsert(uniqueNovos, { 
          onConflict: 'registro_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('[admin-import-integrantes] Error upserting:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao processar integrantes', details: upsertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedCount = uniqueNovos.length;
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
