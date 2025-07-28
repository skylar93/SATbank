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

  // Helper method to get profile with retry
  private static async getProfileWithRetry(userId: string, retries = 2): Promise<{ data: UserProfile | null; error: any }> {
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
          console.log(`🔄 AuthService: Profile fetch failed, retrying... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          return { data: null, error: profileError }
        }
      } catch (error) {
        if (i < retries) {
          console.log(`🔄 AuthService: Profile fetch error, retrying... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          return { data: null, error }
        }
      }
    }
    return { data: null, error: new Error('Max retries reached') }
  }

  // Get current user with profile
  static async getCurrentUser(): Promise<AuthUser | null> {
    console.log('🔍 AuthService: Getting current user...')
    
    try {
      // First try to get session (faster and more reliable)
      console.log('🔍 AuthService: Checking session first...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ AuthService: Session error:', sessionError)
      }
      
      if (session?.user) {
        console.log('🔍 AuthService: Using session user:', session.user.email)
        const user = session.user
        
        // Get profile with retry logic
        console.log('🔍 AuthService: Querying user_profiles for user ID:', user.id)
        const { data: profile, error: profileError } = await this.getProfileWithRetry(user.id)
        
        console.log('🔍 AuthService: Profile query response:', { profile, profileError })

        if (profileError) {
          console.error('❌ AuthService: Error getting profile:', profileError)
          if (profileError.code !== 'PGRST116') {
            console.warn('⚠️ AuthService: Profile fetch failed, continuing without profile')
          }
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
      }
      
      // Fallback to getUser() with longer timeout
      console.log('🔍 AuthService: No session found, calling supabase.auth.getUser()...')
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getUser() timeout after 20 seconds')), 20000)
      )
      
      const { data: { user }, error: userError } = await Promise.race([getUserPromise, timeoutPromise]) as any
      console.log('🔍 AuthService: getUser() response received:', { user: user?.email, error: userError })
      
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
      const { data: profile, error: profileError } = await this.getProfileWithRetry(user.id)
      
      console.log('🔍 AuthService: Profile query response:', { profile, profileError })

      if (profileError) {
        console.error('❌ AuthService: Error getting profile:', profileError)
        if (profileError.code !== 'PGRST116') {
          console.warn('⚠️ AuthService: Profile fetch failed, continuing without profile')
        }
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