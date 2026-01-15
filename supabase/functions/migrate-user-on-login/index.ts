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

    console.log('[migrate-user-on-login] Checking for existing profile:', user_id)

    // Verificar se já existe profile com este user_id
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, profile_status')
      .eq('id', user_id)
      .maybeSingle()

    if (existingProfile) {
      console.log('[migrate-user-on-login] Profile already exists:', existingProfile.id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          migrated: false,
          message: 'Profile already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('[migrate-user-on-login] Creating new profile for user:', user_id)
    
    // Criar novo profile
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user_id,
        name: full_name || email.split('@')[0],
        email: email,
        photo_url: avatar_url || '',
        profile_status: 'Pendente',
        status: 'Online',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('[migrate-user-on-login] Error creating profile:', insertError)
      
      // Se for erro de duplicata (race condition), não é fatal
      if (insertError.code === '23505') {
        console.log('[migrate-user-on-login] Duplicate key - profile already exists')
        return new Response(
          JSON.stringify({ 
            success: true, 
            migrated: false,
            message: 'Profile already exists'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      
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
      // Não falha se role já existe
      if (roleError.code !== '23505') {
        throw roleError
      }
    }

    console.log('[migrate-user-on-login] New profile created successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        migrated: false,
        new_user: true,
        message: 'New profile created'
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
