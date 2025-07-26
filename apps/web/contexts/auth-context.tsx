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
    let retryCount = 0
    const maxRetries = 3
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⏰ AuthProvider: Auth initialization timed out, setting loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second timeout for better UX
    
    const initializeAuth = async () => {
      try {
        console.log(`🔄 AuthProvider: Getting initial user (attempt ${retryCount + 1}/${maxRetries})...`)
        const user = await AuthService.getCurrentUser()
        console.log('👤 AuthProvider: Initial user:', user?.email || 'none')
        isInitialized = true
        clearTimeout(timeoutId)
        setUser(user)
        setError(null) // Clear any previous errors
        setLoading(false)
      } catch (err: any) {
        console.error('❌ AuthProvider: Error getting initial user:', err)
        retryCount++
        
        if (retryCount < maxRetries && !isInitialized) {
          console.log(`🔄 AuthProvider: Retrying in 2 seconds... (${retryCount}/${maxRetries})`)
          setTimeout(initializeAuth, 2000)
        } else {
          isInitialized = true
          clearTimeout(timeoutId)
          setError(err.message)
          setLoading(false)
        }
      }
    }
    
    initializeAuth()

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
      // Wait a moment for auth state to update, then manually fetch user if needed
      setTimeout(async () => {
        try {
          const currentUser = await AuthService.getCurrentUser()
          if (currentUser) {
            setUser(currentUser)
            setLoading(false)
          }
        } catch (err) {
          console.warn('⚠️ AuthProvider: Could not fetch user after sign in, will rely on auth state change')
        }
      }, 1000)
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