import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@satbank/database-types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createBrowserSupabaseClient<Database>()

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'student' | 'admin'
  grade_level: number | null
  target_score: number | null
  created_at: string
  updated_at: string
}

export interface CreateUserProfile {
  email: string
  full_name: string
  role?: 'student' | 'admin'
  grade_level?: number | null
  target_score?: number | null
}

export interface AuthUser {
  id: string
  email: string
  profile: UserProfile | null
}

export class AuthService {
  // Sign up new user
  static async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) throw error
    return data
  }

  // Sign in user
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  // Sign out user
  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Get current user with profile
  static async getCurrentUser(): Promise<AuthUser | null> {
    console.log('🔍 AuthService: Getting current user...')
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('❌ AuthService: Error getting user:', userError)
        throw userError
      }
      
      if (!user) {
        console.log('👤 AuthService: No user found')
        return null
      }

      console.log('👤 AuthService: User found:', user.email, user.id)

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('❌ AuthService: Error getting profile:', profileError)
        // Don't throw here, just return user without profile
      }

      console.log('👤 AuthService: Profile:', profile)

      return {
        id: user.id,
        email: user.email!,
        profile,
      }
    } catch (error) {
      console.error('❌ AuthService: Unexpected error in getCurrentUser:', error)
      throw error
    }
  }

  // Update user profile
  static async updateProfile(userId: string, updates: Partial<CreateUserProfile>) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Check if user is admin
  static async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('is_admin', { user_id: userId })

    if (error) throw error
    return data || false
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthService: Auth state change event:', event, session?.user?.email)
      
      try {
        if (session?.user) {
          console.log('🔄 AuthService: Session found, getting user profile...')
          const authUser = await this.getCurrentUser()
          console.log('🔄 AuthService: Calling callback with user:', authUser?.email)
          callback(authUser)
        } else {
          console.log('🔄 AuthService: No session, calling callback with null')
          callback(null)
        }
      } catch (error) {
        console.error('❌ AuthService: Error in auth state change:', error)
        callback(null)
      }
    })
  }
}