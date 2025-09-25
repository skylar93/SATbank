'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Settings, Eye, Trash2 } from 'lucide-react'
import { CurveAssignmentControl } from './CurveAssignmentControlSimple'
import { AnswerVisibilityControl } from './AnswerVisibilityControlSimple'
import { DeleteExamConfirmDialog } from './DeleteExamConfirmDialog'
import { supabase } from '@/lib/supabase'

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
}

interface ExamRowProps {
  exam: ExamWithCurves
  openAnswerModal: (examId: string, examTitle: string) => void
  onExamDeleted?: () => void
}

export function ExamRow({
  exam,
  openAnswerModal,
  onExamDeleted,
}: ExamRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [allCurves, setAllCurves] = useState<ScoringCurve[]>([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch all scoring curves when component mounts
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

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors duration-150">
        <td className="px-3 py-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
            {exam.title}
          </div>
          {exam.description && (
            <div className="text-xs text-gray-500 truncate max-w-xs">
              {exam.description}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600">
          {new Date(exam.created_at).toLocaleDateString()}
        </td>
        <td className="px-3 py-2">
          <CurveAssignmentControl
            examId={exam.id}
            curveType="english"
            currentCurveName={exam.english_curve_name}
            currentCurveId={exam.english_scoring_curve_id}
            allCurves={allCurves}
            scoringGroups={exam.scoring_groups}
          />
        </td>
        <td className="px-3 py-2">
          <CurveAssignmentControl
            examId={exam.id}
            curveType="math"
            currentCurveName={exam.math_curve_name}
            currentCurveId={exam.math_scoring_curve_id}
            allCurves={allCurves}
            scoringGroups={exam.scoring_groups}
          />
        </td>
        <td className="px-3 py-2">
          {exam.answer_release_setting ? (
            <AnswerVisibilityControl
              examId={exam.id}
              currentVisibility={exam.answer_release_setting}
            />
          ) : (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
              No Setting
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center space-x-1">
            <Link
              href={`/admin/exams/${exam.id}/settings`}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Settings"
            >
              <Settings className="h-3 w-3" />
            </Link>
            <Link
              href={`/admin/exams/${exam.id}/preview`}
              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
              title="Preview & Edit"
            >
              <Eye className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
              title="Delete Exam"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h5 className="text-xs font-medium text-gray-700 mb-2">
                  Scoring Configuration
                </h5>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-xs text-gray-600">
                      English Curve:
                    </span>
                    <CurveAssignmentControl
                      examId={exam.id}
                      curveType="english"
                      currentCurveName={exam.english_curve_name}
                      currentCurveId={exam.english_scoring_curve_id}
                      allCurves={allCurves}
                      scoringGroups={exam.scoring_groups}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-xs text-gray-600">Math Curve:</span>
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
                <h5 className="text-xs font-medium text-gray-700 mb-2">
                  Quick Actions
                </h5>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/exams/${exam.id}/settings`}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Settings
                  </Link>
                  <Link
                    href={`/admin/exams/${exam.id}/preview`}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    Preview
                  </Link>
                  <button
                    onClick={() => openAnswerModal(exam.id, exam.title)}
                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                  >
                    Manage Answers
                  </button>
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

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
