'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AnswerReleaseModal from '@/components/admin/AnswerReleaseModal'

interface ExamWithCurves {
  id: string
  title: string
  description: string
  created_at: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

export default function ExamsListPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [exams, setExams] = useState<ExamWithCurves[]>([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    examId: string
    examTitle: string
  }>({
    isOpen: false,
    examId: '',
    examTitle: '',
  })

  useEffect(() => {
    if (user && isAdmin) {
      fetchExamsWithCurves()
    }
  }, [user, isAdmin])

  const fetchExamsWithCurves = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(
          `
          id,
          title,
          description,
          created_at,
          english_scoring_curve_id,
          math_scoring_curve_id,
          english_curve:english_scoring_curve_id(curve_name),
          math_curve:math_scoring_curve_id(curve_name)
        `
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching exams:', error)
        return
      }

      // Transform the data to flatten the curve names and fetch answer visibility stats
      const transformedData = await Promise.all(
        (data || []).map(async (exam) => {
          // Fetch one attempt to determine the exam's answer release setting
          const { data: attempts } = await supabase
            .from('test_attempts')
            .select('answers_visible, answers_visible_after')
            .eq('exam_id', exam.id)
            .limit(1)

          let answerReleaseSetting
          if (attempts && attempts.length > 0) {
            const attempt = attempts[0]

            if (!attempt.answers_visible) {
              answerReleaseSetting = {
                type: 'hidden' as const,
              }
            } else if (
              attempt.answers_visible &&
              !attempt.answers_visible_after
            ) {
              answerReleaseSetting = {
                type: 'immediate' as const,
              }
            } else if (
              attempt.answers_visible &&
              attempt.answers_visible_after
            ) {
              answerReleaseSetting = {
                type: 'scheduled' as const,
                scheduled_date: new Date(attempt.answers_visible_after),
              }
            }
          } else {
            // Default setting when no attempts exist: Release immediately
            answerReleaseSetting = {
              type: 'immediate' as const,
            }
          }

          return {
            id: exam.id,
            title: exam.title,
            description: exam.description,
            created_at: exam.created_at,
            english_scoring_curve_id: exam.english_scoring_curve_id,
            math_scoring_curve_id: exam.math_scoring_curve_id,
            english_curve_name:
              (Array.isArray(exam.english_curve)
                ? exam.english_curve[0]?.curve_name
                : (exam.english_curve as any)?.curve_name) || null,
            math_curve_name:
              (Array.isArray(exam.math_curve)
                ? exam.math_curve[0]?.curve_name
                : (exam.math_curve as any)?.curve_name) || null,
            answer_release_setting: answerReleaseSetting,
          }
        })
      )

      setExams(transformedData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerVisibilityUpdate = async (
    visibilityOption: 'hidden' | 'immediate' | 'scheduled' | 'per_question',
    releaseTimestamp?: Date
  ) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch(
        '/api/functions/update-answer-visibility-for-exam',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            examId: modalState.examId,
            visibilityOption,
            releaseTimestamp: releaseTimestamp?.toISOString(),
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update answer visibility')
      }

      alert(
        `Successfully updated answer visibility for ${result.updatedAttempts} attempts`
      )
    } catch (error) {
      console.error('Error updating answer visibility:', error)
      alert('Failed to update answer visibility. Please try again.')
    }
  }

  const openAnswerModal = (examId: string, examTitle: string) => {
    setModalState({
      isOpen: true,
      examId,
      examTitle,
    })
  }

  const closeAnswerModal = () => {
    setModalState({
      isOpen: false,
      examId: '',
      examTitle: '',
    })
  }

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading exams...</p>
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

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Exam Management
            </h1>
            <p className="text-gray-600">View and manage all available exams</p>
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
        {/* Exams Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Exams</h2>
          </div>

          {exams.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No exams found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-64">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                      English Curve
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                      Math Curve
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                      Answer Visibility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {exams.map((exam) => (
                    <tr
                      key={exam.id}
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {exam.title}
                          </div>
                          {exam.description && (
                            <div className="text-xs text-gray-600 mt-1 max-w-xs truncate">
                              {exam.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(exam.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {exam.english_curve_name ? (
                          <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded-full border border-purple-200 shadow-sm">
                            #{exam.english_curve_name.split(' ')[0]}: English
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                            Not Assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {exam.math_curve_name ? (
                          <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 rounded-full border border-orange-200 shadow-sm">
                            #{exam.math_curve_name.split(' ')[0]}: Math
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                            Not Assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {exam.answer_release_setting ? (
                          <div className="space-y-1">
                            {exam.answer_release_setting.type ===
                              'immediate' && (
                              <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full border border-green-200 shadow-sm">
                                ✓ Answers Visible
                              </span>
                            )}
                            {exam.answer_release_setting.type === 'hidden' && (
                              <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-red-100 to-pink-100 text-red-700 rounded-full border border-red-200 shadow-sm">
                                🔒 Answers Hidden
                              </span>
                            )}
                            {exam.answer_release_setting.type ===
                              'scheduled' && (
                              <span className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 rounded-full border border-orange-200 shadow-sm">
                                ⏰ Scheduled Release
                              </span>
                            )}

                            {exam.answer_release_setting.type === 'scheduled' &&
                              exam.answer_release_setting.scheduled_date && (
                                <div className="text-xs text-gray-600">
                                  Release:{' '}
                                  {exam.answer_release_setting.scheduled_date.toLocaleString()}
                                </div>
                              )}
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                            No Setting
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openAnswerModal(exam.id, exam.title)}
                            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 rounded-full border border-orange-200 hover:from-orange-200 hover:to-red-200 transition-all duration-200 shadow-sm"
                          >
                            Answer Settings
                          </button>
                          <Link
                            href={`/admin/exams/${exam.id}/settings`}
                            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full border border-blue-200 hover:from-blue-200 hover:to-purple-200 transition-all duration-200 shadow-sm"
                          >
                            Settings
                          </Link>
                          <Link
                            href={`/admin/exams/${exam.id}/preview`}
                            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-full border border-emerald-200 hover:from-emerald-200 hover:to-teal-200 transition-all duration-200 shadow-sm"
                          >
                            Preview & Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {exams.length}
            </div>
            <div className="text-sm text-gray-600">Total Exams</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {
                exams.filter((e) => e.english_curve_name && e.math_curve_name)
                  .length
              }
            </div>
            <div className="text-sm text-gray-600">Fully Configured</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-orange-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {
                exams.filter((e) => !e.english_curve_name || !e.math_curve_name)
                  .length
              }
            </div>
            <div className="text-sm text-gray-600">Need Configuration</div>
          </div>
        </div>
      </div>

      <AnswerReleaseModal
        isOpen={modalState.isOpen}
        onClose={closeAnswerModal}
        examId={modalState.examId}
        examTitle={modalState.examTitle}
        onConfirm={handleAnswerVisibilityUpdate}
      />
    </div>
  )
}
