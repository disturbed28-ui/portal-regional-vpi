import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const {
      admin_user_id,
      profile_id,
      name,
      nome_colete,
      comando_id,
      regional,
      divisao,
      cargo,
      funcao,
      regional_id,
      divisao_id,
      cargo_id,
      funcao_id,
      data_entrada,
      grau,
      profile_status,
      observacao,
    } = await req.json();

    if (!admin_user_id || !profile_id) {
      return new Response(
        JSON.stringify({ error: 'admin_user_id and profile_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking admin role for user:', admin_user_id);

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id);

    console.log('Roles found:', roles);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating profile:', profile_id, 'by admin:', admin_user_id);

    // Preparar payload de atualização - adicionar apenas campos fornecidos
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Adicionar campos apenas se fornecidos explicitamente
    if (name !== undefined) updatePayload.name = name;
    if (nome_colete !== undefined) updatePayload.nome_colete = nome_colete;
    if (comando_id !== undefined) updatePayload.comando_id = comando_id;
    if (regional_id !== undefined) updatePayload.regional_id = regional_id;
    if (divisao_id !== undefined) updatePayload.divisao_id = divisao_id;
    if (cargo_id !== undefined) updatePayload.cargo_id = cargo_id;
    if (funcao_id !== undefined) updatePayload.funcao_id = funcao_id;
    if (data_entrada !== undefined) updatePayload.data_entrada = data_entrada;
    if (grau !== undefined) updatePayload.grau = grau;
    if (profile_status !== undefined) updatePayload.profile_status = profile_status;
    if (observacao !== undefined) updatePayload.observacao = observacao;

    console.log('Update payload:', updatePayload);

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profile_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated successfully:', updatedProfile);

    return new Response(
      JSON.stringify({ success: true, profile: updatedProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in admin-update-profile:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});