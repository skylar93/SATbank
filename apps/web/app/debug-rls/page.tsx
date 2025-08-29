'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { supabase } from '../../lib/supabase'

export default function DebugRLSPage() {
  const { user } = useAuth()
  // Use the centralized Supabase client
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      runRLSTests()
    }
  }, [user])

  const runRLSTests = async () => {
    setLoading(true)
    const testResults: any[] = []

    try {
      // Test 1: Check current auth state from Supabase directly
      console.log('Testing Supabase auth state...')
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      testResults.push({
        test: 'Supabase Auth User',
        success: !authError && !!authUser,
        error: authError?.message,
        data: authUser,
        authUid: authUser?.id,
        contextUserId: user?.id,
        match: authUser?.id === user?.id,
      })

      // Test 2: Try to create a simple test attempt
      console.log('Testing test_attempts insert...')
      const testAttempt = {
        user_id: user?.id,
        exam_id: null,
        status: 'not_started' as const,
        is_practice_mode: true,
        current_module: 'english1' as const,
        current_question_number: 1,
      }

      const { data: attemptData, error: attemptError } = await supabase
        .from('test_attempts')
        .insert(testAttempt)
        .select()

      testResults.push({
        test: 'Create Test Attempt',
        success: !attemptError,
        error: attemptError?.message,
        data: attemptData,
        attemptPayload: testAttempt,
      })

      // Test 3: Check if we can read our own test attempts
      console.log('Testing test_attempts select...')
      const { data: ownAttempts, error: selectError } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', user?.id)

      testResults.push({
        test: 'Read Own Test Attempts',
        success: !selectError,
        error: selectError?.message,
        data: ownAttempts,
        count: ownAttempts?.length || 0,
      })

      // Test 4: Try to use auth.uid() directly in a query
      console.log('Testing auth.uid() function...')
      const { data: authUidTest, error: authUidError } =
        await supabase.rpc('test_auth_uid')

      testResults.push({
        test: 'Auth UID Function Test',
        success: !authUidError,
        error: authUidError?.message,
        data: authUidTest,
      })

      // Test 5: Debug practice creation specifically
      console.log('Testing practice creation debug...')
      const { data: practiceDebug, error: practiceDebugError } =
        await supabase.rpc('debug_practice_creation', {
          test_user_id: user?.id,
        })

      testResults.push({
        test: 'Practice Creation Debug',
        success: !practiceDebugError,
        error: practiceDebugError?.message,
        data: practiceDebug,
      })

      // Test 6: Test practice insert function
      console.log('Testing practice insert function...')
      const { data: practiceInsert, error: practiceInsertError } =
        await supabase.rpc('test_practice_insert', { test_user_id: user?.id })

      testResults.push({
        test: 'Practice Insert Test',
        success: !practiceInsertError && practiceInsert?.[0]?.success,
        error:
          practiceInsertError?.message || practiceInsert?.[0]?.error_message,
        data: practiceInsert,
      })

      // Test 7: Check user profile in database
      console.log('Testing user profile lookup...')
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

      testResults.push({
        test: 'User Profile Lookup',
        success: !profileError,
        error: profileError?.message,
        data: profile,
      })
    } catch (err: any) {
      console.error('RLS test error:', err)
      testResults.push({
        test: 'RLS Test Error',
        success: false,
        error: err.message,
        data: null,
      })
    }

    setResults(testResults)
    setLoading(false)
  }

  const testDirectInsert = async () => {
    if (!user || !supabase) return

    try {
      console.log('Testing direct insert with detailed logging...')

      // Get current auth user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      console.log('Auth user:', authUser)
      console.log('Context user:', user)

      const insertData = {
        user_id: authUser?.id, // Use auth user ID instead of context user ID
        exam_id: null,
        status: 'not_started' as const,
        is_practice_mode: true,
        current_module: 'english1' as const,
        current_question_number: 1,
      }

      console.log('Insert data:', insertData)

      const { data, error } = await supabase
        .from('test_attempts')
        .insert(insertData)
        .select()

      console.log('Insert result:', { data, error })

      if (error) {
        alert(`Insert failed: ${error.message}`)
      } else {
        alert(`Insert successful! Created attempt: ${data[0]?.id}`)
      }
    } catch (error: any) {
      console.error('Direct insert error:', error)
      alert(`Direct insert error: ${error.message}`)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Debug RLS Page
          </h1>
          <p className="text-gray-600">Please log in to test RLS policies.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              RLS Debug Tests
            </h1>
            <div className="space-x-2">
              <button
                onClick={runRLSTests}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
              >
                {loading ? 'Running Tests...' : 'Run Tests Again'}
              </button>
              <button
                onClick={testDirectInsert}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Test Direct Insert
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  result.success
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{result.test}</h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      result.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {result.success ? 'PASS' : 'FAIL'}
                  </span>
                </div>

                {result.error && (
                  <div className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}

                {/* Special display for auth comparison */}
                {result.authUid && (
                  <div className="mb-2">
                    <div className="text-sm">
                      <strong>Auth UID:</strong> {result.authUid}
                    </div>
                    <div className="text-sm">
                      <strong>Context User ID:</strong> {result.contextUserId}
                    </div>
                    <div
                      className={`text-sm font-medium ${result.match ? 'text-green-600' : 'text-red-600'}`}
                    >
                      <strong>Match:</strong> {result.match ? 'YES' : 'NO'}
                    </div>
                  </div>
                )}

                {result.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      View Data
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Running RLS tests...</p>
            </div>
          )}

          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">
              Current Context Info
            </h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(
                {
                  userId: user.id,
                  email: user.email,
                  profile: user.profile,
                },
                null,
                2
              )}
            </pre>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Purpose:</strong> This page tests RLS policies and auth
              state to identify why practice session creation is failing.
            </p>
            <p>
              <strong>Check:</strong> Look for mismatches between auth.uid() and
              context user.id
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
