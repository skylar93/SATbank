import { supabase } from './supabase'

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

      console.log('🔍 AuthService: Querying user_profiles for user ID:', user.id)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      console.log('🔍 AuthService: Profile query response:', { profile, profileError })

      if (profileError) {
        console.error('❌ AuthService: Error getting profile:', profileError)
        console.error('❌ AuthService: Profile error details:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        })
        
        // Check if it's a missing profile (which is normal for new users)
        if (profileError.code === 'PGRST116') {
          console.log('📝 AuthService: User profile not found, this is normal for new users')
        } else {
          console.warn('⚠️ AuthService: Profile fetch failed, continuing without profile')
        }
        // Don't throw here, just return user without profile
      }

      console.log('👤 AuthService: Profile query result:', { 
        profile, 
        hasProfile: !!profile,
        profileRole: profile?.role 
      })

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
    let lastUserId: string | null = null
    
    return supabase.auth.onAuthStateChange(async (event, session) => {
      // Only log and process if the user actually changed
      const currentUserId = session?.user?.id || null
      if (currentUserId === lastUserId && event !== 'INITIAL_SESSION') {
        return // Skip duplicate events for the same user
      }
      
      console.log('🔄 AuthService: Auth state change event:', event, session?.user?.email)
      lastUserId = currentUserId
      
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