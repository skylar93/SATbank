'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../contexts/auth-context'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionTest, setSessionTest] = useState('')
  
  const { signIn, user, loading: authLoading, error: authError, isAdmin, isStudent } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')


    try {
      await signIn(email, password)
      
      // Test session immediately after login
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (session) {
          setSessionTest(`✅ Session found: ${session.user.email}`)
          // Backup redirect if useEffect doesn't work
          setTimeout(() => {
            window.location.href = '/student/dashboard'
          }, 2000)
        } else {
          setSessionTest(`❌ No session found after login: ${error?.message || 'Unknown error'}`)
        }
      }, 1000)
      
      // Don't set loading to false here, let AuthContext handle it
      // This prevents the form from becoming interactive again before redirect
    } catch (err: any) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  // Manual redirect after successful auth
  React.useEffect(() => {
    if (user && !authLoading) {
      
      // Force redirect regardless of role detection issues
      const redirectPath = user.profile?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'
      
      // Use window.location for more reliable redirect
      window.location.href = redirectPath
    }
  }, [user, authLoading, router])

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          {authError && (
            <div className="text-red-600 text-sm text-center">Auth Error: {authError}</div>
          )}


          <div>
            <button
              type="submit"
              disabled={loading || authLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}