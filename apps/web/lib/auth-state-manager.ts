import { supabase } from './supabase'
import type { AuthUser, UserProfile } from './auth'

class AuthStateManager {
  private static instance: AuthStateManager
  private currentRequest: Promise<AuthUser | null> | null = null
  private cache: { user: AuthUser | null; timestamp: number } | null = null
  private readonly CACHE_DURATION = 30000 // 30 seconds
  private subscribers: Set<(user: AuthUser | null) => void> = new Set()

  private constructor() {}

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager()
    }
    return AuthStateManager.instance
  }

  // Subscribe to auth state changes
  subscribe(callback: (user: AuthUser | null) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  // Notify all subscribers
  private notifySubscribers(user: AuthUser | null) {
    this.subscribers.forEach((callback) => {
      try {
        callback(user)
      } catch (error) {
        console.error(
          '❌ AuthStateManager: Error in subscriber callback:',
          error
        )
      }
    })
  }

  // Check if cache is valid
  private isCacheValid(): boolean {
    if (!this.cache) return false
    return Date.now() - this.cache.timestamp < this.CACHE_DURATION
  }

  // Get profile with retry logic
  private async getProfileWithRetry(
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
            `🔄 AuthStateManager: Profile fetch failed, retrying... (${i + 1}/${retries})`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          return { data: null, error: profileError }
        }
      } catch (error) {
        if (i < retries) {
          console.log(
            `🔄 AuthStateManager: Profile fetch error, retrying... (${i + 1}/${retries})`
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          return { data: null, error }
        }
      }
    }
    return { data: null, error: new Error('Max retries reached') }
  }

  // Main method to get current user (with deduplication)
  async getCurrentUser(forceRefresh = false): Promise<AuthUser | null> {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid()) {
      console.log(
        '🎯 AuthStateManager: Returning cached user:',
        this.cache!.user?.email || 'none'
      )
      return this.cache!.user
    }

    // If there's already a request in progress, wait for it
    if (this.currentRequest) {
      console.log(
        '⏳ AuthStateManager: Request already in progress, waiting...'
      )
      return this.currentRequest
    }

    // Create new request
    this.currentRequest = this.fetchCurrentUser()

    try {
      const user = await this.currentRequest
      // Update cache
      this.cache = { user, timestamp: Date.now() }
      console.log(
        '✅ AuthStateManager: User fetched and cached:',
        user?.email || 'none'
      )
      return user
    } finally {
      // Clear the current request
      this.currentRequest = null
    }
  }

  // Internal method to fetch user data
  private async fetchCurrentUser(): Promise<AuthUser | null> {
    console.log('🔍 AuthStateManager: Fetching current user...')

    try {
      // Step 1: Try to get session first (fastest)
      console.log('🔍 AuthStateManager: Checking session...')
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.warn(
          '⚠️ AuthStateManager: Session error:',
          sessionError.message
        )
      }

      if (session?.user) {
        console.log('📱 AuthStateManager: Session found:', session.user.email)
        return await this.buildAuthUser(session.user)
      }

      // Step 2: Fallback to getUser() with shorter timeout
      console.log('🔍 AuthStateManager: No session, trying getUser()...')
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('getUser() timeout after 10 seconds')),
          10000
        )
      )

      const {
        data: { user },
        error: userError,
      } = await Promise.race([getUserPromise, timeoutPromise])

      if (userError) {
        console.error('❌ AuthStateManager: getUser error:', userError)
        throw userError
      }

      if (!user) {
        console.log('👤 AuthStateManager: No user found')
        return null
      }

      console.log('👤 AuthStateManager: User found via getUser():', user.email)
      return await this.buildAuthUser(user)
    } catch (error: any) {
      console.error('❌ AuthStateManager: Error fetching user:', error)

      // If we have cached data and it's a network error, return cached data
      if (
        this.cache &&
        (error.message.includes('timeout') || error.message.includes('fetch'))
      ) {
        console.log(
          '🔄 AuthStateManager: Using cached data due to network error'
        )
        return this.cache.user
      }

      throw error
    }
  }

  // Build AuthUser object with profile
  private async buildAuthUser(user: any): Promise<AuthUser> {
    console.log('🏗️ AuthStateManager: Building auth user for:', user.email)

    // Get profile with retry
    const { data: profile, error: profileError } =
      await this.getProfileWithRetry(user.id)

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn(
        '⚠️ AuthStateManager: Profile fetch failed:',
        profileError.message
      )
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email!,
      profile,
    }

    console.log('✅ AuthStateManager: Auth user built:', {
      email: authUser.email,
      hasProfile: !!authUser.profile,
      role: authUser.profile?.role,
    })

    return authUser
  }

  // Handle auth state changes from Supabase
  handleAuthStateChange(event: string, session: any) {
    console.log(
      '🔄 AuthStateManager: Auth state change:',
      event,
      session?.user?.email || 'no user'
    )

    // Clear cache on auth state changes
    this.cache = null

    if (session?.user) {
      // Don't fetch immediately, let components request when needed
      this.notifySubscribers(null) // Notify that state changed, will trigger re-fetch
    } else {
      // User signed out
      this.notifySubscribers(null)
    }
  }

  // Clear cache and notify subscribers (for sign out)
  clearState() {
    console.log('🧹 AuthStateManager: Clearing state')
    this.cache = null
    this.currentRequest = null
    this.notifySubscribers(null)
  }
}

export const authStateManager = AuthStateManager.getInstance()
