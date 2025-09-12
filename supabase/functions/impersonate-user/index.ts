import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the invoking user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user (admin)
    const { data: { user: adminUser }, error: adminAuthError } = await supabaseClient.auth.getUser()
    if (adminAuthError || !adminUser) {
      throw new Error('Authentication required')
    }

    // Check if the current user is an admin
    const { data: adminProfile, error: adminProfileError } = await supabaseClient
      .from('user_profiles')
      .select('role, email, full_name')
      .eq('id', adminUser.id)
      .single()

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      throw new Error('Admin access required')
    }

    // Get the target user ID from the request
    const { targetUserId } = await req.json()
    if (!targetUserId) {
      throw new Error('Target user ID is required')
    }

    // Get the target user's profile information
    const { data: targetProfile, error: targetProfileError } = await supabaseClient
      .from('user_profiles')
      .select('id, email, full_name, role, grade_level, target_score, show_correct_answers, created_at')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      throw new Error('Target user not found')
    }

    // Ensure we're only impersonating students
    if (targetProfile.role !== 'student') {
      throw new Error('Can only impersonate students')
    }

    // Prepare the impersonation data
    const impersonationData = {
      target_user: {
        id: targetProfile.id,
        email: targetProfile.email,
        profile: {
          id: targetProfile.id,
          user_id: targetProfile.id,
          full_name: targetProfile.full_name,
          email: targetProfile.email,
          role: targetProfile.role,
          grade_level: targetProfile.grade_level,
          target_score: targetProfile.target_score,
          show_correct_answers: targetProfile.show_correct_answers,
          created_at: targetProfile.created_at,
        }
      },
      admin_user: {
        id: adminUser.id,
        email: adminProfile.email,
        full_name: adminProfile.full_name,
      },
      started_at: new Date().toISOString(),
    }

    return new Response(
      JSON.stringify(impersonationData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Impersonation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})