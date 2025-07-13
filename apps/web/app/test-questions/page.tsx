'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { createClient } from '../../lib/supabase'

export default function TestQuestionsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      testQuestionsFetch()
    }
  }, [user])

  const testQuestionsFetch = async () => {
    console.log('🧪 Testing questions fetch exactly like problem bank...')
    setLoading(true)

    try {
      // Test the exact same query as problem bank
      console.log('User ID:', user?.id)
      console.log('User profile:', user?.profile)

      // First, fetch all questions
      console.log('📚 Fetching all questions...')
      const { data: questionsData, error: questionsError } = await supabase!
        .from('questions')
        .select('*')
        .order('module_type')
        .order('question_number')

      console.log('Questions query result:', { questionsData, questionsError })

      if (questionsError) {
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        console.log('❌ No questions found in database')
        setResult({
          status: 'error',
          message: 'No questions found',
          questionsData,
          questionsError
        })
        setLoading(false)
        return
      }

      // Separately fetch user's incorrect answers
      console.log('🎯 Fetching user incorrect answers...')
      const { data: incorrectAnswers, error: answersError } = await supabase!
        .from('user_answers')
        .select(`
          question_id,
          is_correct,
          test_attempts!inner (
            user_id
          )
        `)
        .eq('test_attempts.user_id', user?.id)
        .eq('is_correct', false)

      console.log('Incorrect answers query result:', { incorrectAnswers, answersError })

      if (answersError) {
        console.error('Error fetching user answers:', answersError)
        // Continue without incorrect answer data
      }

      // Create a set of question IDs that were answered incorrectly
      const incorrectQuestionIds = new Set(
        incorrectAnswers?.map(answer => answer.question_id) || []
      )

      // Process questions to mark incorrect ones
      const processedQuestions = questionsData.map(q => ({
        ...q,
        is_incorrect: incorrectQuestionIds.has(q.id)
      }))

      // Extract unique topics
      const topics = new Set<string>()
      processedQuestions.forEach(q => {
        q.topic_tags?.forEach((tag: string) => topics.add(tag))
      })

      console.log(`✅ Successfully loaded ${processedQuestions.length} questions with ${topics.size} unique topics`)

      setResult({
        status: 'success',
        message: `Loaded ${processedQuestions.length} questions`,
        questionsCount: processedQuestions.length,
        topicsCount: topics.size,
        questions: processedQuestions,
        topics: Array.from(topics),
        incorrectCount: incorrectQuestionIds.size
      })

    } catch (error: any) {
      console.error('❌ Error in test:', error)
      setResult({
        status: 'error',
        message: error.message,
        error
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Questions Page</h1>
          <p className="text-gray-600">Please log in to test question fetching.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Test Questions Fetch</h1>
            <button
              onClick={testQuestionsFetch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
            >
              {loading ? 'Testing...' : 'Test Again'}
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Testing question fetch...</p>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${
              result.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <h3 className="font-medium mb-2">
                {result.status === 'success' ? '✅ Success' : '❌ Error'}
              </h3>
              <p className="mb-4">{result.message}</p>

              {result.status === 'success' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white p-3 rounded">
                    <div className="text-2xl font-bold text-blue-600">{result.questionsCount}</div>
                    <div className="text-sm text-gray-600">Questions</div>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <div className="text-2xl font-bold text-green-600">{result.topicsCount}</div>
                    <div className="text-sm text-gray-600">Topics</div>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <div className="text-2xl font-bold text-red-600">{result.incorrectCount}</div>
                    <div className="text-sm text-gray-600">Incorrect Answers</div>
                  </div>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  View Raw Result Data
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Current User Info</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify({
                id: user.id,
                email: user.email,
                profile: user.profile
              }, null, 2)}
            </pre>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Purpose:</strong> This page tests the exact same query logic used in the problem bank to help debug why questions might not be showing up.</p>
            <p><strong>Next:</strong> If this test passes, the issue is likely in the problem bank component's rendering or state management.</p>
            <p><strong>Check console:</strong> Detailed logs are available in the browser console.</p>
          </div>
        </div>
      </div>
    </div>
  )
}