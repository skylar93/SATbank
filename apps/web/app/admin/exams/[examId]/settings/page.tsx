'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { CurveSelector } from '@/components/admin/curve-selector'
import { CurveDistributionChart } from '@/components/admin/curve-distribution-chart'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'

interface ScoringCurve {
  id: number
  curve_name: string
  curve_data?: {
    raw: number
    lower: number
    upper: number
  }[]
}

interface Exam {
  id: string
  title: string
  description: string
  created_at: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  answer_check_mode?: string
}

interface AnswerReleaseSetting {
  type: 'hidden' | 'immediate' | 'scheduled' | 'per_question'
  scheduled_date?: Date
}

export default function EditExamPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const params = useParams()
  const examId = params.examId as string

  const [exam, setExam] = useState<Exam | null>(null)
  const [curves, setCurves] = useState<ScoringCurve[]>([])
  const [selectedEnglishCurve, setSelectedEnglishCurve] = useState<
    number | null
  >(null)
  const [selectedMathCurve, setSelectedMathCurve] = useState<number | null>(
    null
  )
  const [answerReleaseSetting, setAnswerReleaseSetting] =
    useState<AnswerReleaseSetting | null>(null)
  const [answerCheckMode, setAnswerCheckMode] = useState<
    'exam_end' | 'per_question'
  >('exam_end')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const fetchExamAndCurves = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch exam details, scoring curves, and answer visibility stats in parallel
      const [examResponse, curvesResponse, answerStatsResponse] =
        await Promise.all([
          supabase.from('exams').select('*').eq('id', examId).single(),
          supabase
            .from('scoring_curves')
            .select('id, curve_name, curve_data')
            .order('curve_name'),
          supabase
            .from('test_attempts')
            .select(
              `
              id,
              answers_visible,
              answers_visible_after
            `
            )
            .eq('exam_id', examId),
        ])

      if (examResponse.error) {
        console.error('Error fetching exam:', examResponse.error)
        return
      }

      if (curvesResponse.error) {
        console.error('Error fetching curves:', curvesResponse.error)
        return
      }

      const examData = examResponse.data
      setExam(examData)
      setSelectedEnglishCurve(examData.english_scoring_curve_id)
      setSelectedMathCurve(examData.math_scoring_curve_id)
      setAnswerCheckMode(
        (examData.answer_check_mode as 'exam_end' | 'per_question') ||
          'exam_end'
      )
      setCurves(curvesResponse.data || [])

      // Process answer visibility stats
      if (answerStatsResponse.data) {
        const attempts = answerStatsResponse.data

        // Determine answer release setting from exam mode and first attempt
        if (examData.answer_check_mode === 'per_question') {
          setAnswerReleaseSetting({
            type: 'per_question',
          })
        } else if (attempts.length > 0) {
          const attempt = attempts[0]

          if (!attempt.answers_visible) {
            setAnswerReleaseSetting({
              type: 'hidden',
            })
          } else if (
            attempt.answers_visible &&
            !attempt.answers_visible_after
          ) {
            setAnswerReleaseSetting({
              type: 'immediate',
            })
          } else if (attempt.answers_visible && attempt.answers_visible_after) {
            setAnswerReleaseSetting({
              type: 'scheduled',
              scheduled_date: new Date(attempt.answers_visible_after),
            })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [examId, supabase])

  useEffect(() => {
    if (user && isAdmin && examId) {
      fetchExamAndCurves()
    }
  }, [user, isAdmin, examId, fetchExamAndCurves])

  const handleSaveChanges = async () => {
    if (!exam) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('exams')
        .update({
          english_scoring_curve_id: selectedEnglishCurve,
          math_scoring_curve_id: selectedMathCurve,
          answer_check_mode: answerCheckMode,
        })
        .eq('id', examId)

      if (error) {
        console.error('Error updating exam:', error)
        setToast({
          message: `Failed to update exam: ${error.message}`,
          type: 'error',
        })
        return
      }

      // Update local state
      setExam({
        ...exam,
        english_scoring_curve_id: selectedEnglishCurve,
        math_scoring_curve_id: selectedMathCurve,
        answer_check_mode: answerCheckMode,
      })

      setToast({
        message: 'Scoring curves updated successfully!',
        type: 'success',
      })
    } catch (error) {
      console.error('Error saving changes:', error)
      setToast({
        message: 'Failed to save changes. Please try again.',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading exam details...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Exam Not Found
          </h1>
          <p className="text-gray-600">
            The requested exam could not be found.
          </p>
        </div>
      </div>
    )
  }

  const hasChanges =
    selectedEnglishCurve !== exam.english_scoring_curve_id ||
    selectedMathCurve !== exam.math_scoring_curve_id ||
    answerCheckMode !== exam.answer_check_mode

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
            <p className="text-gray-600">
              Configure scoring curves and exam settings
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Exam Details */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <div className="px-6 py-4 -mx-6 -mt-6 mb-4 border-b border-purple-100 bg-gradient-to-r from-purple-500 to-pink-500">
            <h2 className="text-lg font-semibold text-white">
              Exam Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-600 mb-1">
                Title
              </label>
              <p className="text-purple-900 font-medium">{exam.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-600 mb-1">
                Created
              </label>
              <p className="text-purple-900">
                {new Date(exam.created_at).toLocaleDateString()}
              </p>
            </div>
            {exam.description && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-purple-600 mb-1">
                  Description
                </label>
                <p className="text-purple-900">{exam.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Answer Check Mode */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-indigo-100 p-6 mb-6">
          <div className="px-6 py-4 -mx-6 -mt-6 mb-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-500 to-blue-500">
            <h2 className="text-lg font-semibold text-white">
              Answer Check Mode
            </h2>
          </div>
          <p className="text-indigo-600/70 mb-6">
            Choose when students can see correct answers during the exam.
          </p>

          <div className="space-y-4">
            <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="answerCheckMode"
                value="exam_end"
                checked={answerCheckMode === 'exam_end'}
                onChange={(e) =>
                  setAnswerCheckMode(
                    e.target.value as 'exam_end' | 'per_question'
                  )
                }
                className="mr-3 text-indigo-600"
              />
              <div>
                <div className="font-medium text-gray-900">
                  After Exam Completion
                </div>
                <div className="text-sm text-gray-600">
                  Traditional mode - students see answers only after completing
                  the entire exam
                </div>
              </div>
            </label>

            <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="answerCheckMode"
                value="per_question"
                checked={answerCheckMode === 'per_question'}
                onChange={(e) =>
                  setAnswerCheckMode(
                    e.target.value as 'exam_end' | 'per_question'
                  )
                }
                className="mr-3 text-indigo-600"
              />
              <div>
                <div className="font-medium text-gray-900">
                  After Each Question
                </div>
                <div className="text-sm text-gray-600">
                  Students see the correct answer immediately after submitting
                  each question
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Answer Visibility Stats */}
        {answerReleaseSetting && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-emerald-100 p-6 mb-6">
            <div className="px-6 py-4 -mx-6 -mt-6 mb-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-500 to-teal-500">
              <h2 className="text-lg font-semibold text-white">
                Answer Release Setting
              </h2>
            </div>
            <div>
              {answerReleaseSetting.type === 'immediate' && (
                <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="text-lg font-semibold text-green-800">
                      Answers Visible Immediately
                    </div>
                    <div className="text-sm text-green-600">
                      Students can see correct answers right after completing
                      the exam
                    </div>
                  </div>
                </div>
              )}
              {answerReleaseSetting.type === 'hidden' && (
                <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <div className="text-lg font-semibold text-red-800">
                      Answers Hidden
                    </div>
                    <div className="text-sm text-red-600">
                      Correct answers are hidden from all students
                    </div>
                  </div>
                </div>
              )}
              {answerReleaseSetting.type === 'scheduled' && (
                <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <div className="text-lg font-semibold text-orange-800">
                      Scheduled Release
                    </div>
                    <div className="text-sm text-orange-600">
                      Answers will be visible on:{' '}
                      {answerReleaseSetting.scheduled_date?.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              {answerReleaseSetting.type === 'per_question' && (
                <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <div className="text-lg font-semibold text-blue-800">
                      Per-Question Answer Checking
                    </div>
                    <div className="text-sm text-blue-600">
                      Students can see correct answers immediately after
                      submitting each question
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scoring Assignment */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
          <div className="px-6 py-4 -mx-6 -mt-6 mb-4 border-b border-purple-100 bg-gradient-to-r from-purple-500 to-pink-500">
            <h2 className="text-lg font-semibold text-white">
              Scoring Assignment
            </h2>
          </div>
          <p className="text-purple-600/70 mb-6">
            Assign scoring curves to determine how raw scores are converted to
            scaled scores.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reading & Writing Curve */}
            <div>
              <label className="block text-sm font-medium text-purple-600 mb-2">
                Reading & Writing Curve
              </label>
              <CurveSelector
                curves={curves}
                currentCurveId={selectedEnglishCurve}
                onCurveChange={setSelectedEnglishCurve}
                placeholder="Select English curve"
              />
              {selectedEnglishCurve && (
                <div className="mt-2">
                  <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded-full border border-purple-200 shadow-sm">
                    #
                    {curves
                      .find((c) => c.id === selectedEnglishCurve)
                      ?.curve_name.split(' ')[0] || 'Unknown'}
                    : English
                  </span>
                </div>
              )}
            </div>

            {/* Math Curve */}
            <div>
              <label className="block text-sm font-medium text-purple-600 mb-2">
                Math Curve
              </label>
              <CurveSelector
                curves={curves}
                currentCurveId={selectedMathCurve}
                onCurveChange={setSelectedMathCurve}
                placeholder="Select Math curve"
              />
              {selectedMathCurve && (
                <div className="mt-2">
                  <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 rounded-full border border-orange-200 shadow-sm">
                    #
                    {curves
                      .find((c) => c.id === selectedMathCurve)
                      ?.curve_name.split(' ')[0] || 'Unknown'}
                    : Math
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 pt-4 border-t border-purple-200">
            <Button
              onClick={handleSaveChanges}
              disabled={!hasChanges || saving}
              className={`${
                hasChanges
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : 'bg-gray-400 cursor-not-allowed'
              } text-white px-6 py-2 shadow-lg transition-all duration-200`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            {hasChanges && (
              <p className="text-sm text-orange-600 mt-2">
                <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                  You have unsaved changes
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Curve Distribution Visualization */}
        {(selectedEnglishCurve || selectedMathCurve) && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mt-6">
            <div className="px-6 py-4 -mx-6 -mt-6 mb-6 border-b border-purple-100 bg-gradient-to-r from-purple-500 to-pink-500">
              <h2 className="text-lg font-semibold text-white">
                Curve Distribution Analysis
              </h2>
            </div>

            <div className="space-y-6">
              {selectedEnglishCurve && (
                <div>
                  {(() => {
                    const englishCurve = curves.find(
                      (c) => c.id === selectedEnglishCurve
                    )
                    if (!englishCurve?.curve_data) return null

                    return (
                      <CurveDistributionChart
                        curveName={`${englishCurve.curve_name} (Reading & Writing)`}
                        curveData={englishCurve.curve_data}
                        type="line"
                        height={500}
                      />
                    )
                  })()}
                </div>
              )}

              {selectedMathCurve && (
                <div>
                  {(() => {
                    const mathCurve = curves.find(
                      (c) => c.id === selectedMathCurve
                    )
                    if (!mathCurve?.curve_data) return null

                    return (
                      <CurveDistributionChart
                        curveName={`${mathCurve.curve_name} (Math)`}
                        curveData={mathCurve.curve_data}
                        type="line"
                        height={500}
                      />
                    )
                  })()}
                </div>
              )}

              {!selectedEnglishCurve && !selectedMathCurve && (
                <div className="text-center py-12 text-purple-600/70">
                  <p>Select scoring curves above to view their distributions</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
