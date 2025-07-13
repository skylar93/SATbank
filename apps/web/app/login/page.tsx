'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../contexts/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { signIn, user, loading: authLoading, error: authError, isAdmin, isStudent } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    console.log('🔐 Login: Attempting to sign in:', email)

    try {
      await signIn(email, password)
      console.log('✅ Login: Sign in successful')
      // Redirect will be handled by auth context or manually
    } catch (err: any) {
      console.error('❌ Login: Error:', err)
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Manual redirect after successful auth
  React.useEffect(() => {
    if (user && !authLoading) {
      console.log('🔄 Login: User authenticated, redirecting...', user.email, user.profile?.role)
      if (isAdmin) {
        console.log('🔄 Login: Forcing navigation to admin dashboard')
        window.location.href = '/admin/dashboard'
      } else if (isStudent) {
        console.log('🔄 Login: Forcing navigation to student dashboard')
        window.location.href = '/student/dashboard'
      }
    }
  }, [user, authLoading, isAdmin, isStudent])

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

          {/* Debug Info */}
          <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
            <div>Auth Loading: {authLoading.toString()}</div>
            <div>User: {user?.email || 'None'}</div>
            <div>Role: {user?.profile?.role || 'None'}</div>
            <div>Is Admin: {isAdmin.toString()}</div>
            <div>Is Student: {isStudent.toString()}</div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}