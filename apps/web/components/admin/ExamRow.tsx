'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings, Eye, Trash2 } from 'lucide-react'
import { CurveAssignmentControl } from './CurveAssignmentControlSimple'
import { AnswerVisibilityControl } from './AnswerVisibilityControlSimple'
import { DeleteExamConfirmDialog } from './DeleteExamConfirmDialog'
import { supabase } from '@/lib/supabase'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'

interface ScoringCurve {
  id: number
  curve_name: string
  description?: string
}

interface ExamWithCurves {
  id: string
  title: string
  description: string
  created_at: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  template_id: string | null
  scoring_groups?: { [key: string]: string[] }
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
  total_questions?: number | null
  total_attempts_count?: number
  is_custom_assignment?: boolean
}

interface ExamRowProps {
  exam: ExamWithCurves
  openAnswerModal: (examId: string, examTitle: string) => void
  onExamDeleted?: () => void
  onExamUpdated?: () => void
  className?: string
  isStandaloneModule?: boolean
}

export function ExamRow({
  exam,
  openAnswerModal,
  onExamDeleted,
  onExamUpdated,
  className,
  isStandaloneModule = false,
}: ExamRowProps) {
  const [isExpanded, setIsExpanded] = usePersistentState(`exam-row-expanded-${exam.id}`, false)
  const [allCurves, setAllCurves] = useState<ScoringCurve[]>([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  const [titleDraft, setTitleDraft] = useState(exam.title)
  const [descriptionDraft, setDescriptionDraft] = useState(exam.description || '')

  useEffect(() => {
    setTitleDraft(exam.title)
    setDescriptionDraft(exam.description || '')
  }, [exam.id, exam.title, exam.description])

  const trimmedTitle = titleDraft.trim()
  const trimmedDescription = descriptionDraft.trim()
  const originalTitle = exam.title.trim()
  const originalDescription = (exam.description || '').trim()
  const hasDetailsChanged =
    trimmedTitle !== originalTitle || trimmedDescription !== originalDescription

  const handleResetDetails = () => {
    setTitleDraft(exam.title)
    setDescriptionDraft(exam.description || '')
  }

  const handleSaveDetails = async () => {
    if (!trimmedTitle) {
      alert('Exam name is required.')
      return
    }

    setIsSavingDetails(true)
    try {
      const { error } = await supabase
        .from('exams')
        .update({
          title: trimmedTitle,
          description: trimmedDescription ? trimmedDescription : null,
        })
        .eq('id', exam.id)

      if (error) {
        console.error('Error updating exam details:', error)
        alert('Failed to update exam details. Please try again.')
        return
      }

      alert('Exam details updated successfully!')
      setTitleDraft(trimmedTitle)
      setDescriptionDraft(trimmedDescription)
      if (onExamUpdated) {
        await onExamUpdated()
      }
    } catch (error) {
      console.error('Error updating exam details:', error)
      alert('Failed to update exam details. Please try again.')
    } finally {
      setIsSavingDetails(false)
    }
  }

  useEffect(() => {
    const fetchCurves = async () => {
      try {
        const { data, error } = await supabase
          .from('scoring_curves')
          .select('id, curve_name, description')
          .order('curve_name')

        if (error) {
          console.error('Error fetching scoring curves:', error)
          return
        }

        setAllCurves(data || [])
      } catch (error) {
        console.error('Error:', error)
      }
    }

    fetchCurves()
  }, [])

  const handleDeleteExam = async () => {
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('exams').delete().eq('id', exam.id)

      if (error) {
        console.error('Error deleting exam:', error)
        alert('Failed to delete exam. Please try again.')
        return
      }

      alert('Exam deleted successfully!')
      setIsDeleteDialogOpen(false)
      if (onExamDeleted) {
        onExamDeleted()
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete exam. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const createdDisplay = new Date(exam.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const attemptsLabel = typeof exam.total_attempts_count === 'number' && exam.total_attempts_count > 0
    ? `${exam.total_attempts_count} attempt${exam.total_attempts_count === 1 ? '' : 's'}`
    : null

  const actionButtons = (
    <div className="flex items-center gap-1">
      <Link
        href={`/admin/exams/${exam.id}/settings`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 rounded-full"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Link>
      <Link
        href={`/admin/exams/${exam.id}/preview`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 text-green-600 transition-colors hover:bg-green-50 hover:text-green-800 rounded-full"
        title="Preview & Edit"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        onClick={() => setIsDeleteDialogOpen(true)}
        className="p-1.5 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 rounded-full"
        title="Delete Exam"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <>
      <div
        className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 ${
          className ?? ''
        }`}
      >
        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="rounded-full border border-slate-200 bg-slate-50 p-2 text-gray-500 transition hover:bg-slate-100 hover:text-gray-700 focus:outline-none"
                >
                  <span className="sr-only">
                    {isExpanded ? 'Collapse exam details' : 'Expand exam details'}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-semibold text-gray-900 md:text-base">
                    {exam.title}
                  </p>
                  {exam.description && (
                    <p className="mt-1 text-xs text-gray-500 md:text-sm">
                      {exam.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {typeof exam.total_questions === 'number' && exam.total_questions > 0 && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {exam.total_questions} question{exam.total_questions === 1 ? '' : 's'}
                      </span>
                    )}
                    {exam.is_custom_assignment && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                        Custom Assignment
                      </span>
                    )}
                    {exam.template_id && (
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600">
                        Template linked
                      </span>
                    )}
                    {isStandaloneModule && !exam.template_id && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                        Standalone module
                      </span>
                    )}
                    {attemptsLabel && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                        {attemptsLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex">{actionButtons}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:gap-4 md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Created
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {createdDisplay}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  English Curve
                </p>
                <div className="mt-2">
                  <CurveAssignmentControl
                    examId={exam.id}
                    curveType="english"
                    currentCurveName={exam.english_curve_name}
                    currentCurveId={exam.english_scoring_curve_id}
                    allCurves={allCurves}
                    scoringGroups={exam.scoring_groups}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Math Curve
                </p>
                <div className="mt-2">
                  <CurveAssignmentControl
                    examId={exam.id}
                    curveType="math"
                    currentCurveName={exam.math_curve_name}
                    currentCurveId={exam.math_scoring_curve_id}
                    allCurves={allCurves}
                    scoringGroups={exam.scoring_groups}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Answer Visibility
                </p>
                <div className="mt-2">
                  {exam.answer_release_setting ? (
                    <AnswerVisibilityControl
                      examId={exam.id}
                      currentVisibility={exam.answer_release_setting}
                    />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      No setting
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-start md:justify-end">
                <div className="md:hidden">{actionButtons}</div>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 md:px-6 md:py-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Exam Details
                </h5>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Exam Name
                    </label>
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter exam name"
                      disabled={isSavingDetails}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Description
                    </label>
                    <textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="Optional description"
                      disabled={isSavingDetails}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleResetDetails}
                      disabled={!hasDetailsChanged || isSavingDetails}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDetails}
                      disabled={!hasDetailsChanged || isSavingDetails}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingDetails ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scoring Configuration
                </h5>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-600">English Curve</span>
                    <CurveAssignmentControl
                      examId={exam.id}
                      curveType="english"
                      currentCurveName={exam.english_curve_name}
                      currentCurveId={exam.english_scoring_curve_id}
                      allCurves={allCurves}
                      scoringGroups={exam.scoring_groups}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-600">Math Curve</span>
                    <CurveAssignmentControl
                      examId={exam.id}
                      curveType="math"
                      currentCurveName={exam.math_curve_name}
                      currentCurveId={exam.math_scoring_curve_id}
                      allCurves={allCurves}
                      scoringGroups={exam.scoring_groups}
                    />
                  </div>
                </div>
              </div>
              <div>
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Quick Actions
                </h5>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Link
                    href={`/admin/exams/${exam.id}/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/admin/exams/${exam.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                  >
                    Preview
                  </Link>
                  <button
                    onClick={() => openAnswerModal(exam.id, exam.title)}
                    className="rounded-lg bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-100"
                  >
                    Manage Answers
                  </button>
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeleteExamConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteExam}
        examTitle={exam.title}
        isDeleting={isDeleting}
      />
    </>
  )
}
