import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDatabaseError, logError } from '../_shared/error-handler.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestSchema = z.object({
      admin_user_id: z.string().uuid('ID de admin inválido'),
      profile_id: z.string().uuid('ID de perfil inválido'),
      integrante_portal_id: z.string().uuid().optional().nullable(),
      desvincular: z.boolean().optional(),
      name: z.string().max(200).optional(),
      nome_colete: z.string().max(100).optional(),
      comando_id: z.string().uuid().optional().nullable(),
      regional: z.string().max(100).optional(),
      divisao: z.string().max(100).optional(),
      cargo: z.string().max(100).optional(),
      funcao: z.string().max(100).optional(),
      regional_id: z.string().uuid().optional().nullable(),
      divisao_id: z.string().uuid().optional().nullable(),
      cargo_id: z.string().uuid().optional().nullable(),
      funcao_id: z.string().uuid().optional().nullable(),
      data_entrada: z.string().optional().nullable(),
      grau: z.string().max(50).optional(),
      profile_status: z.string().max(50).optional(),
      observacao: z.string().max(1000).optional().nullable()
    });

    const {
      admin_user_id,
      profile_id,
      integrante_portal_id,
      desvincular,
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
    } = requestSchema.parse(await req.json());

    console.log('Checking admin role for user:', admin_user_id);

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id);

    console.log('Roles found:', roles);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      logError('admin-update-profile', roleError || 'Not an admin', { admin_user_id });
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
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
      logError('admin-update-profile', updateError, { profile_id });
      return new Response(
        JSON.stringify({ error: handleDatabaseError(updateError) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated successfully:', updatedProfile);

    // Se foi solicitado desvinculação
    if (desvincular === true) {
      console.log('Desvincular todos os integrantes do profile:', profile_id);
      
      const { error: unlinkError } = await supabase
        .from('integrantes_portal')
        .update({
          profile_id: null,
          vinculado: false,
          data_vinculacao: null,
        })
        .eq('profile_id', profile_id)
        .eq('vinculado', true);

      if (unlinkError) {
        console.error('Error unlinking integrante_portal:', unlinkError);
      } else {
        console.log('Integrante(s) desvinculado(s) com sucesso');
      }
    }
    // Se foi fornecido integrante_portal_id, vincular
    else if (integrante_portal_id) {
      console.log('Linking integrante_portal:', integrante_portal_id, 'to profile:', profile_id);
      
      // Primeiro, desvincular qualquer integrante anterior deste profile
      await supabase
        .from('integrantes_portal')
        .update({
          profile_id: null,
          vinculado: false,
          data_vinculacao: null,
        })
        .eq('profile_id', profile_id);
      
      // Depois, vincular o novo integrante
      const { error: linkError } = await supabase
        .from('integrantes_portal')
        .update({
          profile_id: profile_id,
          vinculado: true,
          data_vinculacao: new Date().toISOString(),
        })
        .eq('id', integrante_portal_id);

      if (linkError) {
        console.error('Error linking integrante_portal:', linkError);
      } else {
        console.log('Integrante vinculado com sucesso');
      }
    }

    return new Response(
      JSON.stringify({ success: true, profile: updatedProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logError('admin-update-profile', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('admin-update-profile', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});