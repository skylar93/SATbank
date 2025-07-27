import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Check if environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
  console.error('Copy .env.example to .env.local and fill in your Supabase project details')
}

// Create a single shared Supabase client instance
export const supabase = (() => {
  // During build time, return a mock client to prevent build failures
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables, using mock client')
    return createSupabaseClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTcwMDAwMDAwMH0.mocktoken', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  }
  
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  })
})()

// Export the same instance for all usage
export const createClient = () => supabase

// Note: Using singleton pattern to prevent multiple GoTrueClient instances