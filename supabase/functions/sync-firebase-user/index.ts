import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FirebaseUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken, displayName, photoURL, uid } = await req.json();

    if (!uid) {
      console.error('Missing uid');
      return new Response(
        JSON.stringify({ error: 'Missing uid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing Firebase user:', { uid, displayName });

    // Create Supabase client with service_role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    console.log('Existing profile:', existingProfile);

    // Step 1: Check for existing Firebase UID → Supabase UUID mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('firebase_auth_mapping')
      .select('supabase_uid')
      .eq('firebase_uid', uid)
      .maybeSingle();

    if (mappingError) {
      console.error('Error checking mapping:', mappingError);
    }

    console.log('Existing mapping:', mapping);

    let supabaseUid: string;
    let supabaseAuthUser;

    if (!mapping) {
      console.log('No mapping found, creating new Supabase Auth user...');
      
      // Create new Supabase Auth user WITHOUT specifying ID (let Supabase auto-generate UUID)
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: `firebase_${uid}@placeholder.local`,
        email_confirm: true,
        user_metadata: {
          firebase_uid: uid,
          name: displayName || 'Visitante',
          avatar_url: photoURL || '',
          provider: 'firebase'
        }
      });

      if (createError) {
        console.error('Error creating auth user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create auth user', details: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabaseAuthUser = createData.user;
      supabaseUid = createData.user.id;
      console.log('Auth user created with Supabase UUID:', supabaseUid);

      // Save mapping Firebase UID → Supabase UUID
      const { error: insertMappingError } = await supabase
        .from('firebase_auth_mapping')
        .insert({
          firebase_uid: uid,
          supabase_uid: supabaseUid
        });

      if (insertMappingError) {
        console.error('Error saving mapping:', insertMappingError);
        return new Response(
          JSON.stringify({ error: 'Failed to save mapping', details: insertMappingError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Mapping saved successfully');
    } else {
      console.log('Mapping found, using existing Supabase UUID:', mapping.supabase_uid);
      supabaseUid = mapping.supabase_uid;

      // Get existing auth user
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(supabaseUid);
      
      if (authError || !authData?.user) {
        console.error('Error getting auth user:', authError);
        return new Response(
          JSON.stringify({ error: 'Auth user not found for existing mapping' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabaseAuthUser = authData.user;

      // Update metadata if needed
      await supabase.auth.admin.updateUserById(supabaseUid, {
        user_metadata: {
          firebase_uid: uid,
          name: displayName || 'Visitante',
          avatar_url: photoURL || ''
        }
      });

      console.log('Auth user metadata updated');
    }

    // Generate recovery link (includes tokens in hash fragment)
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: `firebase_${supabaseUid}@placeholder.local`
    });

    if (sessionError || !sessionData) {
      console.error('Error generating recovery link:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate recovery link', details: sessionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Recovery link generated successfully');

    // Extract tokens from hash fragment (#access_token=...&refresh_token=...)
    const actionLink = sessionData.properties.action_link;
    const hashMatch = actionLink.match(/#(.+)$/);
    
    if (!hashMatch) {
      console.error('Failed to extract hash from recovery link');
      return new Response(
        JSON.stringify({ error: 'Failed to extract hash from recovery link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hashParams = new URLSearchParams(hashMatch[1]);
    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');

    if (!access_token || !refresh_token) {
      console.error('Tokens not found in recovery link hash');
      return new Response(
        JSON.stringify({ error: 'Failed to extract tokens from hash' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tokens extracted successfully from hash');

    if (!existingProfile) {
      // Create new profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: uid,
          name: displayName || 'Visitante',
          photo_url: photoURL || '',
          status: 'Online',
          profile_status: 'Pendente'
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to create profile', details: profileError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Profile created successfully');

      // Assign default 'user' role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: uid,
          role: 'user'
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
        return new Response(
          JSON.stringify({ error: 'Failed to assign role', details: roleError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Role assigned successfully');
    } else {
      // Update existing profile - preserve critical fields
      const updateData: {
        status: string;
        name?: string;
        photo_url?: string;
      } = {
        status: 'Online'  // Always update presence status
      };

      // Always update name if provided (to ensure Google profile changes sync)
      if (displayName) {
        updateData.name = displayName;
        if (displayName !== existingProfile.name) {
          console.log(`Updating name: ${existingProfile.name} -> ${displayName}`);
        }
      }

      // Always update photo if provided (to ensure Google profile photo changes sync)
      if (photoURL) {
        updateData.photo_url = photoURL;
        if (photoURL !== existingProfile.photo_url) {
          console.log(`Updating photo_url: ${existingProfile.photo_url} -> ${photoURL}`);
        }
      }

      // Log for debugging
      console.log('Update data:', JSON.stringify(updateData, null, 2));

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', uid);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update profile', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Profile updated successfully (preserved nome_colete and other fields)');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Profile synced successfully',
        session: {
          access_token: access_token,
          refresh_token: refresh_token
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-firebase-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
