import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@satbank/database-types'

// Check if environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
  console.error('Copy .env.example to .env.local and fill in your Supabase project details')
}

// Client-side Supabase client
export const createClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  return createBrowserSupabaseClient<Database>()
}

// Note: Use createClient() instead of a default export to ensure 
// proper session synchronization across the application