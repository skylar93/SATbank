'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AuthService, type AuthUser } from '../lib/auth'

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
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⏰ AuthProvider: Auth initialization timed out, setting loading to false')
        setLoading(false)
      }
    }, 5000) // 5 second timeout
    
    // Get initial user
    AuthService.getCurrentUser()
      .then((user) => {
        console.log('👤 AuthProvider: Initial user:', user)
        isInitialized = true
        clearTimeout(timeoutId)
        setUser(user)
        setLoading(false)
      })
      .catch((err) => {
        console.error('❌ AuthProvider: Error getting initial user:', err)
        isInitialized = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = AuthService.onAuthStateChange((user) => {
      console.log('🔄 AuthProvider: Auth state changed:', user)
      if (isInitialized) {
        clearTimeout(timeoutId) // Clear timeout since we got a response
        setUser(user)
        setLoading(false)
      }
    })

    return () => {
      console.log('🧹 AuthProvider: Cleanup')
      clearTimeout(timeoutId)
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
      // Don't manually set user here, let the auth state change handle it
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

  console.log('🏷️ AuthProvider: Current state:', { user: user?.email, role: user?.profile?.role, loading, error })

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