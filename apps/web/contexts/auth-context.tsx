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
  // Get impersonation data from localStorage
  const getImpersonationUser = (): AuthUser | null => {
    if (typeof window === 'undefined') return null
    
    const dataJSON = localStorage.getItem('impersonation_data')
    if (!dataJSON) return null
    
    try {
      const data = JSON.parse(dataJSON)
      return data.target_user || null
    } catch {
      return null
    }
  }

  // Initialize with null to avoid hydration issues
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isInitialized = false
    
    // Simpler initialization with AuthStateManager
    const initializeAuth = async () => {
      try {
        // Check for impersonation first - this is synchronous and fast
        const impersonationUser = getImpersonationUser()
        if (impersonationUser) {
          isInitialized = true
          setUser(impersonationUser)
          setError(null)
          setLoading(false)
          return
        }

        // Only fetch from auth state manager if not impersonating
        const user = await authStateManager.getCurrentUser()
        isInitialized = true
        setUser(user)
        setError(null)
        setLoading(false)
      } catch (err: any) {
        isInitialized = true
        setError(err.message)
        setLoading(false)
      }
    }
    
    // Run initialization immediately
    initializeAuth()

    // Listen for impersonation changes via storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'impersonation_data') {
        const impersonationUser = getImpersonationUser()
        if (impersonationUser) {
          setUser(impersonationUser)
        } else {
          // Impersonation ended - don't reload, let the page handle redirection
          // This prevents duplicate API calls and infinite loading
          console.log('🔄 AuthProvider: Impersonation ended, waiting for navigation...')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Subscribe to auth state changes from AuthStateManager
    const unsubscribeFromStateManager = authStateManager.subscribe(async (stateChangedUser) => {
      // Check for impersonation first, it takes precedence
      const impersonationUser = getImpersonationUser()
      if (impersonationUser) {
        setUser(impersonationUser)
        isInitialized = true
        setLoading(false)
        setError(null)
        return
      }
      
      if (stateChangedUser === null) {
        // State manager notified of change, fetch fresh user data
        try {
          const currentUser = await authStateManager.getCurrentUser()
          setUser(currentUser)
        } catch (err: any) {
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
      window.removeEventListener('storage', handleStorageChange)
      unsubscribeFromStateManager()
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signIn(email, password)
      
      // Immediately try to get user data
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        setLoading(false)
      } else {
        // Don't set loading to false here, let auth state change handle it
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signUp(email, password, fullName)
      // Don't manually set user here, let the auth state change handle it
    } catch (err: any) {
      console.error('❌ AuthProvider: Sign up error:', err)
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await AuthService.signOut()
      setUser(null)
      // Redirect to login page after successful logout
      window.location.href = '/login'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.profile?.role === 'admin'
  const isStudent = user?.profile?.role === 'student'


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