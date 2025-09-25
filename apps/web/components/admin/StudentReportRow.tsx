'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDuration } from '../../lib/utils'
import { getDisplayScores } from '../../lib/score-display-utils'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'

interface AttemptData {
  attempt_id: string
  completed_at: string
  duration_seconds: number
  final_scores: {
    overall?: number
    english?: number
    math?: number
  } | null
  student_id: string
  student_full_name: string
  student_email: string
  exam_id: string
  exam_title: string
  template_id?: string | null
}

interface StudentData {
  student_id: string
  student_full_name: string
  student_email: string
  attempts: AttemptData[]
  avgScore: number
  totalAttempts: number
  lastActive: string
}

interface StudentReportRowProps {
  student: StudentData
}

export default function StudentReportRow({ student }: StudentReportRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)


  return (
    <>
      {/* Trigger Row */}
      <tr
        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200 cursor-pointer border-b border-purple-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
            )}
            <div>
              <div className="text-sm font-medium text-gray-900">
                {student.student_full_name}
              </div>
              <div className="text-xs text-gray-500">
                {student.student_email}
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-bold text-gray-900">
            {student.avgScore}/1600
          </div>
          <div className="text-xs text-gray-500">Average Score</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{student.totalAttempts}</div>
          <div className="text-xs text-gray-500">Total Attempts</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {new Date(student.lastActive).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <div className="text-xs text-gray-500">Last Active</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm text-gray-500">
            Click to {isExpanded ? 'collapse' : 'expand'}
          </span>
        </td>
      </tr>

      {/* Expanded Content Row */}
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-0 py-0">
            <div className="bg-gradient-to-r from-purple-25 to-pink-25 border-t border-purple-100">
              <div className="px-6 py-4">
                <div className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">
                  Individual Attempts for {student.student_full_name}
                </div>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Exam
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Total Score
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          English
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Math
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Completed
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {student.attempts.map((attempt) => {
                        const displayScores = getDisplayScores(attempt.final_scores, attempt.template_id)

                        return (
                          <tr
                            key={attempt.attempt_id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(
                                `/admin/results/${attempt.attempt_id}`,
                                '_blank'
                              )
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">
                                {attempt.exam_title}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">
                                {displayScores.overall}/{displayScores.maxTotal}
                              </div>
                            </td>
                            {displayScores.sections.showEnglish && (
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-700">
                                  {displayScores.english || 0}/800
                                </div>
                              </td>
                            )}
                            {displayScores.sections.showMath && (
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-700">
                                  {displayScores.math || 0}/800
                                </div>
                              </td>
                            )}
                            {!displayScores.sections.showEnglish && !displayScores.sections.showMath && (
                              <>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-400">N/A</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-400">N/A</div>
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-700">
                                {formatDuration(attempt.duration_seconds)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-700">
                                {new Date(
                                  attempt.completed_at
                                ).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex space-x-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    window.open(`/admin/results/${attempt.attempt_id}`, '_blank')
                                  }}
                                  className="text-gray-500 hover:text-gray-700"
                                  title="View Results"
                                >
                                  <EyeIcon className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    window.open(`/admin/results/${attempt.attempt_id}/review`, '_blank')
                                  }}
                                  className="text-gray-500 hover:text-gray-700"
                                  title="Review Exam"
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
