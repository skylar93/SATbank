'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { supabase } from '../../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const {
    user,
    signIn,
    signOut,
    loading: authLoading,
    error: authError,
  } = useAuth()
  const router = useRouter()

  // Fallback redirect if middleware doesn't work
  useEffect(() => {
    if (user && !authLoading) {
      console.log('🔄 User already logged in, performing router redirect...', user)
      const redirectUrl = user.profile?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'
      console.log('🔄 Redirecting to:', redirectUrl)
      router.replace(redirectUrl)
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent form submission if user is already logged in
    if (user) {
      console.log('🚫 User already logged in, preventing duplicate login attempt')
      return
    }
    
    console.log('🚀 Login form submitted', { email })
    setLoading(true)
    setError('')

    try {
      // 1. Await the signIn function and receive the user object
      console.log('📞 Calling signIn function...')
      const loggedInUser = await signIn(email, password)
      console.log('✅ SignIn successful, user:', loggedInUser)

      // 2. Let middleware handle the redirect - it will automatically redirect to the right dashboard
      console.log('✅ Login successful, letting middleware handle redirect...')
      // Middleware will automatically redirect logged-in users to their dashboard

    } catch (err: any) {
      console.error('❌ Login failed:', err)
      setError(err.message || 'Login failed')
      setLoading(false) // Only set loading to false on error
    }
  }

  // Middleware will handle redirect after successful login

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to SAT Practice
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your SAT mock exams and practice tests
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={!!user}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={!!user}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          {authError && (
            <div className="text-red-600 text-sm text-center">
              Auth Error: {authError}
            </div>
          )}

          {user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <div className="text-sm text-yellow-800">
                <p><strong>Already logged in as:</strong> {user.email}</p>
                <p><strong>Role:</strong> {user.profile?.role}</p>
                <button
                  onClick={() => signOut()}
                  className="mt-2 text-red-600 hover:text-red-800 underline"
                >
                  Sign out to try different account
                </button>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || authLoading || !!user}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {user ? 'Already signed in' : loading || authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
