'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AnswerReleaseModal from '@/components/admin/AnswerReleaseModal'
import { ExamRow } from './ExamRow'
import { Button } from '@/components/ui/button'
import { CreateExamModal } from './CreateExamModal'

// Interface for the data returned by get_admin_exams_list RPC
interface RpcExamData {
  id: string
  title: string
  description: string
  created_at: string
  is_active: boolean
  total_questions: number
  english_curve_id: number | null
  math_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  latest_attempt_visibility: boolean | null
  latest_attempt_visible_after: string | null
  total_attempts_count: number
  template_id?: string | null
  is_custom_assignment?: boolean
  exam_type?: 'original' | 'template' | 'custom'
}

// Transformed interface for UI consumption
interface ExamWithCurves {
  id: string
  title: string
  description: string
  created_at: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  template_id?: string | null
  is_custom_assignment?: boolean
  exam_type?: 'original' | 'template' | 'custom'
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

export function ExamsListClient() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [exams, setExams] = useState<ExamWithCurves[]>([])
  const [loading, setLoading] = useState(true)
  const [filteredExams, setFilteredExams] = useState<ExamWithCurves[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [updatingExams, setUpdatingExams] = useState<Set<string>>(new Set())
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    examId: string
    examTitle: string
  }>({
    isOpen: false,
    examId: '',
    examTitle: '',
  })

  // Fetch exams using the optimized RPC function
  useEffect(() => {
    if (user && isAdmin) {
      fetchExamsOptimized()
    }
  }, [user, isAdmin])

  const fetchExamsOptimized = async () => {
    setLoading(true)
    try {
      // Use the optimized RPC function for better performance
      const { data: rpcData, error } = await supabase.rpc(
        'get_admin_exams_list'
      )

      if (error) {
        console.error('Error fetching exams:', error)
        return
      }

      // Transform RPC data to UI format
      const transformedData: ExamWithCurves[] = (rpcData || []).map(
        (exam: RpcExamData) => {
          // Determine answer release setting based on RPC data
          let answerReleaseSetting
          if (exam.latest_attempt_visibility === null) {
            // No attempts exist: default to hidden (safer default)
            answerReleaseSetting = {
              type: 'hidden' as const,
            }
          } else if (!exam.latest_attempt_visibility) {
            answerReleaseSetting = {
              type: 'hidden' as const,
            }
          } else if (
            exam.latest_attempt_visibility &&
            !exam.latest_attempt_visible_after
          ) {
            answerReleaseSetting = {
              type: 'immediate' as const,
            }
          } else if (
            exam.latest_attempt_visibility &&
            exam.latest_attempt_visible_after
          ) {
            answerReleaseSetting = {
              type: 'scheduled' as const,
              scheduled_date: new Date(exam.latest_attempt_visible_after),
            }
          }

          return {
            id: exam.id,
            title: exam.title,
            description: exam.description,
            created_at: exam.created_at,
            english_scoring_curve_id: exam.english_curve_id,
            math_scoring_curve_id: exam.math_curve_id,
            english_curve_name: exam.english_curve_name,
            math_curve_name: exam.math_curve_name,
            template_id: exam.template_id || null,
            is_custom_assignment: exam.is_custom_assignment || false,
            exam_type: exam.exam_type || 'original',
            answer_release_setting: answerReleaseSetting,
          }
        }
      )

      setExams(transformedData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filtering when data or search changes
  useEffect(() => {
    console.log('🔄 Filtering exams, exams length:', exams.length)
    if (!searchTerm.trim()) {
      setFilteredExams(exams)
    } else {
      const filtered = exams.filter(
        (exam) =>
          exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredExams(filtered)
    }
    console.log('✅ filteredExams updated')
  }, [exams, searchTerm])

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

      // Refresh data after update
      await fetchExamsOptimized()
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

  // Handle inline visibility updates with optimistic updates
  const handleInlineVisibilityUpdate = async (
    examId: string,
    visibility: 'hidden' | 'immediate' | 'scheduled',
    releaseDate?: string | null
  ) => {
    console.log('🔄 handleInlineVisibilityUpdate called:', { examId, visibility, releaseDate })
    
    // Backup original state for potential revert
    const originalExams = [...exams]
    const originalFilteredExams = [...filteredExams]
    
    // 1. Optimistic Update: Update the local state immediately
    const newExams = exams.map(exam => {
      if (exam.id === examId) {
        let newSetting
        if (visibility === 'scheduled' && releaseDate) {
          newSetting = {
            type: 'scheduled' as const,
            scheduled_date: new Date(releaseDate)
          }
        } else if (visibility === 'immediate') {
          newSetting = { type: 'immediate' as const }
        } else {
          newSetting = { type: 'hidden' as const }
        }
        
        return {
          ...exam,
          answer_release_setting: newSetting
        }
      }
      return exam
    })
    
    // Also update filteredExams directly
    const newFilteredExams = filteredExams.map(exam => {
      if (exam.id === examId) {
        let newSetting
        if (visibility === 'scheduled' && releaseDate) {
          newSetting = {
            type: 'scheduled' as const,
            scheduled_date: new Date(releaseDate)
          }
        } else if (visibility === 'immediate') {
          newSetting = { type: 'immediate' as const }
        } else {
          newSetting = { type: 'hidden' as const }
        }
        
        return {
          ...exam,
          answer_release_setting: newSetting
        }
      }
      return exam
    })
    
    console.log('🎯 Setting optimistic update:', newExams.find(e => e.id === examId)?.answer_release_setting)
    console.log('🎯 New filtered exam for ID:', newFilteredExams.find(e => e.id === examId)?.answer_release_setting)
    
    setExams(newExams)
    setFilteredExams(newFilteredExams)
    
    console.log('✅ State updates called')

    // Mark as updating
    setUpdatingExams(prev => new Set(prev).add(examId))

    try {
      // 2. Call the Server Action
      const { updateAnswerVisibilityForAttempt } = await import('@/lib/exam-actions')
      const result = await updateAnswerVisibilityForAttempt(examId, visibility, releaseDate)

      if (!result.success) {
        // 3. Handle Failure: Revert to the original state
        setExams(originalExams)
        setFilteredExams(originalFilteredExams)
        alert(`Failed to update: ${result.message}`)
      } else {
        // 4. On success, optimistic update was correct, no refetch needed
        console.log('✅ Answer visibility updated successfully')
      }
    } catch (error) {
      console.error('Error updating answer visibility:', error)
      setExams(originalExams)
      setFilteredExams(originalFilteredExams)
      alert('Failed to update answer visibility. Please try again.')
    } finally {
      // Remove from updating set
      setUpdatingExams(prev => {
        const newSet = new Set(prev)
        newSet.delete(examId)
        return newSet
      })
    }
  }

  const handleExamCreated = (newExamId: string) => {
    setIsCreateModalOpen(false)
    router.push(`/admin/exams/${newExamId}/settings`)
  }

  const handleDeleteTemplate = async (examId: string, examTitle: string) => {
    // Confirm deletion
    const confirmed = confirm(
      `Are you sure you want to delete the template exam "${examTitle}"?\n\n` +
      `This action will:\n` +
      `✓ Delete the template exam\n` +
      `✓ Delete all associated test attempts\n` +
      `✓ Preserve original questions safely\n\n` +
      `This cannot be undone.`
    )
    
    if (!confirmed) return

    try {
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('template_id, is_custom_assignment')
        .eq('id', examId)
        .single()

      if (examError) {
        throw new Error('Failed to verify exam type')
      }

      // Safety check: Only allow deletion of template/custom exams
      if (!exam.template_id && !exam.is_custom_assignment) {
        alert('❌ Safety check failed: Only template exams can be deleted.')
        return
      }

      // Additional safety check: Ensure no direct questions
      const { data: directQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id')
        .eq('exam_id', examId)
        .limit(1)

      if (questionsError) {
        throw new Error('Failed to verify question ownership')
      }

      if (directQuestions && directQuestions.length > 0) {
        alert('❌ Safety check failed: This exam has direct questions and cannot be deleted.')
        return
      }

      // Delete in correct order: test_attempts → exam_questions → exams
      console.log('🗑️ Starting safe template deletion...')

      // 1. Delete test attempts (and user_answers cascade)
      const { error: deleteAttemptsError } = await supabase
        .from('test_attempts')
        .delete()
        .eq('exam_id', examId)

      if (deleteAttemptsError) {
        throw new Error(`Failed to delete test attempts: ${deleteAttemptsError.message}`)
      }

      // 2. Delete exam questions (connections only, preserves original questions)
      const { error: deleteExamQuestionsError } = await supabase
        .from('exam_questions')
        .delete()
        .eq('exam_id', examId)

      if (deleteExamQuestionsError) {
        throw new Error(`Failed to delete exam questions: ${deleteExamQuestionsError.message}`)
      }

      // 3. Delete the exam itself
      const { error: deleteExamError } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId)

      if (deleteExamError) {
        throw new Error(`Failed to delete exam: ${deleteExamError.message}`)
      }

      console.log('✅ Template exam deleted successfully')
      
      // Show success message
      alert(`✅ Template exam "${examTitle}" has been safely deleted.\n\nOriginal questions have been preserved.`)
      
      // Refresh the exam list
      await fetchExamsOptimized()
      
    } catch (error) {
      console.error('Error deleting template exam:', error)
      alert(`❌ Failed to delete template exam: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              ＋ New Exam
            </Button>
            <Link href="/admin/exams/create">
              <Button
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                ＋ New from Template
              </Button>
            </Link>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
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

          {filteredExams.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">
                {searchTerm
                  ? 'No exams match your search criteria.'
                  : 'No exams found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                      {/* Expand/Collapse column */}
                    </th>
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
                  {filteredExams.map((exam) => (
                    <ExamRow
                      key={exam.id}
                      exam={exam}
                      openAnswerModal={openAnswerModal}
                      onDeleteTemplate={handleDeleteTemplate}
                      isUpdating={updatingExams.has(exam.id)}
                      onVisibilityUpdate={handleInlineVisibilityUpdate}
                    />
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
              {filteredExams.length}
            </div>
            <div className="text-sm text-gray-600">
              {searchTerm ? 'Filtered Exams' : 'Total Exams'}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {
                filteredExams.filter(
                  (e) => e.english_curve_name && e.math_curve_name
                ).length
              }
            </div>
            <div className="text-sm text-gray-600">Fully Configured</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-orange-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {
                filteredExams.filter(
                  (e) => !e.english_curve_name || !e.math_curve_name
                ).length
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

      <CreateExamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onExamCreated={handleExamCreated}
      />
    </div>
  )
}
