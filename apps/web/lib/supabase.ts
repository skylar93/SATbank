import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@satbank/database-types'

// Check if environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
  console.error('Copy .env.example to .env.local and fill in your Supabase project details')
}

// Create a singleton Supabase client instance
let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

// Client-side Supabase client
export const createClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  // Return the same instance if it already exists
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  // Create new instance only if it doesn't exist
  supabaseInstance = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
  
  return supabaseInstance
}

// Create a shared client instance for services
export const supabase = createClient()

// Note: Using singleton pattern to prevent multiple GoTrueClient instances