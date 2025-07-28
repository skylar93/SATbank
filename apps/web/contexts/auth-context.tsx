'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AuthService, type AuthUser } from '../lib/auth'
import { authStateManager } from '../lib/auth-state-manager'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isStudent: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing...')
    let isInitialized = false
    
    // Simpler initialization with AuthStateManager
    const initializeAuth = async () => {
      try {
        console.log('🔄 AuthProvider: Getting initial user...')
        const user = await authStateManager.getCurrentUser()
        console.log('👤 AuthProvider: Initial user:', user?.email || 'none')
        isInitialized = true
        setUser(user)
        setError(null)
        setLoading(false)
      } catch (err: any) {
        console.error('❌ AuthProvider: Error getting initial user:', err)
        isInitialized = true
        setError(err.message)
        setLoading(false)
      }
    }
    
    initializeAuth()

    // Subscribe to auth state changes from AuthStateManager
    const unsubscribeFromStateManager = authStateManager.subscribe(async (stateChangedUser) => {
      console.log('🔄 AuthProvider: Auth state changed:', stateChangedUser?.email || 'signed out')
      
      if (stateChangedUser === null) {
        // State manager notified of change, fetch fresh user data
        try {
          const currentUser = await authStateManager.getCurrentUser()
          setUser(currentUser)
        } catch (err: any) {
          console.error('❌ AuthProvider: Error fetching user after state change:', err)
          setUser(null)
          setError(err.message)
        }
      } else {
        setUser(stateChangedUser)
      }
      
      isInitialized = true
      setLoading(false)
      setError(null)
    })

    // Also listen to Supabase auth changes and forward to AuthStateManager
    const { data: { subscription } } = AuthService.onAuthStateChange(() => {
      // AuthService.onAuthStateChange now delegates to AuthStateManager
      // This subscription is mainly for cleanup
    })

    return () => {
      console.log('🧹 AuthProvider: Cleanup')
      unsubscribeFromStateManager()
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('🔐 AuthProvider: Signing in...', email)
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signIn(email, password)
      console.log('✅ AuthProvider: Sign in successful')
      
      // Immediately try to get user data
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser) {
        console.log('👤 AuthProvider: User data retrieved after sign in:', currentUser.email)
        setUser(currentUser)
        setLoading(false)
      } else {
        console.warn('⚠️ AuthProvider: No user data after sign in, waiting for auth state change')
        // Don't set loading to false here, let auth state change handle it
      }
    } catch (err: any) {
      console.error('❌ AuthProvider: Sign in error:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log('📝 AuthProvider: Signing up...', email)
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signUp(email, password, fullName)
      console.log('✅ AuthProvider: Sign up successful')
      // Don't manually set user here, let the auth state change handle it
    } catch (err: any) {
      console.error('❌ AuthProvider: Sign up error:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const signOut = async () => {
    console.log('🚪 AuthProvider: Signing out...')
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signOut()
      setUser(null)
      console.log('✅ AuthProvider: Sign out successful')
    } catch (err: any) {
      console.error('❌ AuthProvider: Sign out error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.profile?.role === 'admin'
  const isStudent = user?.profile?.role === 'student'

  console.log('🏷️ AuthProvider: Current state:', { 
    user: user?.email, 
    userId: user?.id,
    profile: user?.profile,
    role: user?.profile?.role, 
    isAdmin,
    isStudent,
    loading, 
    error 
  })

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isStudent,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}