import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { user_id, email, full_name, avatar_url } = await req.json()

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'user_id and email are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('[migrate-user-on-login] Checking for existing profile with email:', email)

    // Buscar profile existente pelo email (case insensitive)
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('[migrate-user-on-login] Error fetching users:', authError)
    }

    // Verificar se já existe profile com este UUID (já migrado)
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, profile_status')
      .eq('id', user_id)
      .maybeSingle()

    if (existingProfile) {
      console.log('[migrate-user-on-login] Profile already migrated:', existingProfile.id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          migrated: false,
          message: 'Profile already exists with Supabase UUID'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Buscar profile antigo pelo email usando ilike para case insensitive
    const { data: oldProfiles, error: oldProfileError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('name', `%${email.split('@')[0]}%`)
      .order('created_at', { ascending: true })
      .limit(10)

    if (oldProfileError) {
      console.error('[migrate-user-on-login] Error fetching old profile:', oldProfileError)
    }

    // Tentar encontrar profile que não seja UUID (Firebase UID)
    const oldProfile = oldProfiles?.find(p => {
      // Firebase UIDs não são UUIDs válidos e têm formato diferente
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)
      return !isUUID
    })

    if (!oldProfile) {
      console.log('[migrate-user-on-login] No old Firebase profile found, creating new profile')
      
      // Criar novo profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user_id,
          name: full_name || email.split('@')[0],
          photo_url: avatar_url || '',
          profile_status: 'Pendente',
          status: 'Online',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('[migrate-user-on-login] Error creating profile:', insertError)
        throw insertError
      }

      // Atribuir role padrão 'user'
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user_id,
          role: 'user'
        })

      if (roleError) {
        console.error('[migrate-user-on-login] Error creating role:', roleError)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          migrated: false,
          new_user: true,
          message: 'New profile created'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('[migrate-user-on-login] Found old profile, migrating:', oldProfile.id, '->', user_id)

    // Migrar roles ANTES de atualizar o profile
    const { data: oldRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', oldProfile.id)

    if (rolesError) {
      console.error('[migrate-user-on-login] Error fetching roles:', rolesError)
    }

    // Deletar roles antigas
    if (oldRoles && oldRoles.length > 0) {
      const { error: deleteRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', oldProfile.id)

      if (deleteRolesError) {
        console.error('[migrate-user-on-login] Error deleting old roles:', deleteRolesError)
      }

      // Criar novas roles com novo UUID
      for (const roleRow of oldRoles) {
        const { error: insertRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user_id,
            role: roleRow.role
          })

        if (insertRoleError) {
          console.error('[migrate-user-on-login] Error inserting new role:', insertRoleError)
        }
      }
    }

    // Atualizar integrantes_portal se vinculado
    if (oldProfile.nome_colete) {
      const { error: integranteError } = await supabase
        .from('integrantes_portal')
        .update({ firebase_uid: user_id })
        .eq('firebase_uid', oldProfile.id)

      if (integranteError) {
        console.error('[migrate-user-on-login] Error updating integrante:', integranteError)
      }
    }

    // Deletar profile antigo
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', oldProfile.id)

    if (deleteError) {
      console.error('[migrate-user-on-login] Error deleting old profile:', deleteError)
      throw deleteError
    }

    // Criar novo profile com UUID do Supabase
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user_id,
        name: oldProfile.name,
        photo_url: avatar_url || oldProfile.photo_url,
        nome_colete: oldProfile.nome_colete,
        telefone: oldProfile.telefone,
        profile_status: oldProfile.profile_status,
        observacao: oldProfile.observacao,
        status: 'Online',
        regional: oldProfile.regional,
        divisao: oldProfile.divisao,
        cargo: oldProfile.cargo,
        funcao: oldProfile.funcao,
        grau: oldProfile.grau,
        data_entrada: oldProfile.data_entrada,
        comando_id: oldProfile.comando_id,
        regional_id: oldProfile.regional_id,
        divisao_id: oldProfile.divisao_id,
        cargo_id: oldProfile.cargo_id,
        funcao_id: oldProfile.funcao_id,
        created_at: oldProfile.created_at,
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('[migrate-user-on-login] Error creating new profile:', insertError)
      throw insertError
    }

    console.log('[migrate-user-on-login] Migration successful!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        migrated: true,
        old_id: oldProfile.id,
        new_id: user_id,
        roles_migrated: oldRoles?.length || 0,
        message: 'Profile migrated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[migrate-user-on-login] Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
