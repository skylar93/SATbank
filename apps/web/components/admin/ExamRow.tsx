'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CurveAssignmentControl } from './CurveAssignmentControlSimple'
import { AnswerVisibilityControl } from './AnswerVisibilityControlSimple'
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
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

interface ExamRowProps {
  exam: ExamWithCurves
  openAnswerModal: (examId: string, examTitle: string) => void
}

export function ExamRow({ exam, openAnswerModal }: ExamRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [allCurves, setAllCurves] = useState<ScoringCurve[]>([])

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

  return (
    <>
      {/* Main Row */}
      <tr className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200">
        <td className="px-6 py-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
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
          <CurveAssignmentControl
            examId={exam.id}
            curveType="english"
            currentCurveName={exam.english_curve_name}
            currentCurveId={exam.english_scoring_curve_id}
            allCurves={allCurves}
          />
        </td>
        <td className="px-6 py-4">
          <CurveAssignmentControl
            examId={exam.id}
            curveType="math"
            currentCurveName={exam.math_curve_name}
            currentCurveId={exam.math_scoring_curve_id}
            allCurves={allCurves}
          />
        </td>
        <td className="px-6 py-4">
          {exam.answer_release_setting ? (
            <AnswerVisibilityControl
              examId={exam.id}
              currentVisibility={exam.answer_release_setting}
            />
          ) : (
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full border border-gray-200">
              No Setting
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center space-x-2">
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

      {/* Expanded Row */}
      {isExpanded && (
        <tr className="bg-gradient-to-r from-purple-25 to-pink-25 border-t border-purple-100">
          <td colSpan={7} className="px-12 py-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Exam Details: {exam.title}
                </h3>
                <span className="text-sm text-gray-500">ID: {exam.id}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800">
                    Scoring Configuration
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100">
                      <span className="text-sm text-gray-600">
                        English Curve:
                      </span>
                      <CurveAssignmentControl
                        examId={exam.id}
                        curveType="english"
                        currentCurveName={exam.english_curve_name}
                        currentCurveId={exam.english_scoring_curve_id}
                        allCurves={allCurves}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                      <span className="text-sm text-gray-600">Math Curve:</span>
                      <CurveAssignmentControl
                        examId={exam.id}
                        curveType="math"
                        currentCurveName={exam.math_curve_name}
                        currentCurveId={exam.math_scoring_curve_id}
                        allCurves={allCurves}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800">
                    Answer Visibility
                  </h4>
                  <div className="p-3 bg-white rounded-lg border border-green-100">
                    {exam.answer_release_setting ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Current Setting:
                        </span>
                        <AnswerVisibilityControl
                          examId={exam.id}
                          currentVisibility={exam.answer_release_setting}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No answer visibility setting configured
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-purple-100">
                <h4 className="font-medium text-gray-800 mb-3">
                  Quick Actions
                </h4>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/exams/${exam.id}/settings`}
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-lg border border-blue-200 hover:from-blue-200 hover:to-purple-200 transition-all duration-200 shadow-sm"
                  >
                    Exam Settings
                  </Link>
                  <Link
                    href={`/admin/exams/${exam.id}/preview`}
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-lg border border-emerald-200 hover:from-emerald-200 hover:to-teal-200 transition-all duration-200 shadow-sm"
                  >
                    Preview & Edit Questions
                  </Link>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
