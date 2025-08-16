'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { createClient } from '../../lib/supabase'

export default function DebugPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      runDatabaseTests()
    }
  }, [user])

  const runDatabaseTests = async () => {
    setLoading(true)
    setError(null)
    const testResults: any[] = []

    // Check if Supabase client is initialized
    if (!supabase) {
      setError(
        'Supabase client is not initialized. Please check your environment variables.'
      )
      setLoading(false)
      return
    }

    try {
      // Test 1: Check if we can fetch exams
      console.log('Testing exams table...')
      const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select('*')

      testResults.push({
        test: 'Fetch Exams',
        success: !examsError,
        error: examsError?.message,
        data: exams,
        count: exams?.length || 0,
      })

      // Test 2: Check if we can fetch questions
      console.log('Testing questions table...')
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')

      testResults.push({
        test: 'Fetch Questions',
        success: !questionsError,
        error: questionsError?.message,
        data: questions,
        count: questions?.length || 0,
      })

      // Test 3: Check specific exam questions
      if (exams && exams.length > 0) {
        console.log('Testing questions for specific exam...')
        const { data: examQuestions, error: examQuestionsError } =
          await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', exams[0].id)

        testResults.push({
          test: `Fetch Questions for Exam ${exams[0].title}`,
          success: !examQuestionsError,
          error: examQuestionsError?.message,
          data: examQuestions,
          count: examQuestions?.length || 0,
        })
      }

      // Test 4: Check user profile
      console.log('Testing user profile...')
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user?.id)

      testResults.push({
        test: 'Fetch User Profile',
        success: !profileError,
        error: profileError?.message,
        data: profiles,
        count: profiles?.length || 0,
      })

      // Test 5: Check RLS policies by trying to fetch other users' data
      console.log('Testing RLS policies...')
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('user_profiles')
        .select('*')

      testResults.push({
        test: 'RLS Test (should only see own profile)',
        success: !allProfilesError,
        error: allProfilesError?.message,
        data: allProfiles,
        count: allProfiles?.length || 0,
      })
    } catch (err: any) {
      setError(err.message)
      console.error('Database test error:', err)
    }

    setResults(testResults)
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Debug Page</h1>
          <p className="text-gray-600">Please log in to run database tests.</p>
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
              Database Debug Tests
            </h1>
            <button
              onClick={runDatabaseTests}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
            >
              {loading ? 'Running Tests...' : 'Run Tests Again'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

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
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      Count: {result.count}
                    </span>
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
                </div>

                {result.error && (
                  <div className="text-red-600 text-sm mb-2">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}

                {result.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      View Data (
                      {Array.isArray(result.data) ? result.data.length : 1}{' '}
                      items)
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
              <p className="mt-2 text-gray-600">Running database tests...</p>
            </div>
          )}

          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">
              Current User Info
            </h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(
                {
                  id: user.id,
                  email: user.email,
                  profile: user.profile,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
