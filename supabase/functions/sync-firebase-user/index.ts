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

      // Only update name if there's a new value AND it's different
      if (displayName && displayName !== existingProfile.name) {
        updateData.name = displayName;
        console.log(`Updating name: ${existingProfile.name} -> ${displayName}`);
      }

      // Only update photo if there's a new value AND it's different
      if (photoURL && photoURL !== existingProfile.photo_url) {
        updateData.photo_url = photoURL;
        console.log(`Updating photo_url: ${existingProfile.photo_url} -> ${photoURL}`);
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
      JSON.stringify({ success: true, message: 'Profile synced successfully' }),
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
