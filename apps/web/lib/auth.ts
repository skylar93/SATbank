import { supabase } from './supabase'
import { authStateManager } from './auth-state-manager'

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
  // Test database connectivity
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count', { count: 'exact', head: true })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
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
    try {
      // Clear local storage first
      localStorage.removeItem('sb-eoyzqdsxlweygsukjnef-auth-token')
      
      // Use global scope for complete logout across all devices
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) {
        console.warn('Supabase signOut warning (continuing):', error.message)
      }
    } catch (error: any) {
      console.warn('SignOut error (continuing anyway):', error.message)
    }
    
    // Always clear auth state manager cache
    authStateManager.clearState()
  }

  // Helper method to get profile with retry
  private static async getProfileWithRetry(
    userId: string,
    retries = 2
  ): Promise<{ data: UserProfile | null; error: any }> {
    for (let i = 0; i <= retries; i++) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (!profileError || profileError.code === 'PGRST116') {
          return { data: profile, error: profileError }
        }

        if (i < retries) {
          console.log(
            `🔄 AuthService: Profile fetch failed, retrying... (${i + 1}/${retries})`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          return { data: null, error: profileError }
        }
      } catch (error) {
        if (i < retries) {
          console.log(
            `🔄 AuthService: Profile fetch error, retrying... (${i + 1}/${retries})`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          return { data: null, error }
        }
      }
    }
    return { data: null, error: new Error('Max retries reached') }
  }

  // Get current user with profile (delegated to AuthStateManager)
  static async getCurrentUser(): Promise<AuthUser | null> {
    return authStateManager.getCurrentUser()
  }

  // Update user profile
  static async updateProfile(
    userId: string,
    updates: Partial<CreateUserProfile>
  ) {
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
    const { data, error } = await supabase.rpc('is_admin', { user_id: userId })

    if (error) throw error
    return data || false
  }

  // Listen to auth state changes (delegated to AuthStateManager)
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    // Subscribe to AuthStateManager
    const unsubscribe = authStateManager.subscribe(callback)

    // Also listen to Supabase auth changes and forward to AuthStateManager
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      authStateManager.handleAuthStateChange(event, session)
    })

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            unsubscribe()
            subscription.unsubscribe()
          },
        },
      },
    }
  }
}
