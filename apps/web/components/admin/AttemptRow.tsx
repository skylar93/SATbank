'use client'

import React from 'react'
import Link from 'next/link'
import { formatDuration } from '../../lib/utils'
import {
  getScoreColorClassName,
  getDurationWarning,
} from '../../lib/styling-utils'
import { Eye, PenSquare, AlertTriangle } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'

interface AttemptData {
  attempt_id: string
  completed_at: string
  duration_seconds: number
  final_scores: {
    english?: number
    math?: number
  } | null
  student_id: string
  student_full_name: string
  student_email: string
  exam_id: string
  exam_title: string
}

interface AttemptRowProps {
  attempt: AttemptData
}

export default function AttemptRow({ attempt }: AttemptRowProps) {
  const calculateTotalScore = (finalScores: AttemptData['final_scores']) => {
    if (!finalScores) return 0
    const englishScore = finalScores.english || 0
    const mathScore = finalScores.math || 0
    return englishScore + mathScore
  }

  const totalScore = calculateTotalScore(attempt.final_scores)
  const englishScore = attempt.final_scores?.english || 0
  const mathScore = attempt.final_scores?.math || 0

  return (
    <TableRow
      className="group hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200 cursor-pointer"
      onClick={() =>
        window.open(`/admin/results/${attempt.attempt_id}`, '_blank')
      }
    >
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {attempt.student_full_name}
          </div>
          <div className="text-xs text-gray-500">{attempt.student_email}</div>
        </div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {attempt.exam_title}
        </div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm">
          <span className={getScoreColorClassName(totalScore)}>
            {totalScore}
          </span>
          <span className="text-gray-400">/1600</span>
        </div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{englishScore}/800</div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{mathScore}/800</div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-900">
            {formatDuration(attempt.duration_seconds)}
          </span>
          {getDurationWarning(attempt.duration_seconds) && (
            <div title="This duration seems unusually short or long.">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {new Date(attempt.completed_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </TableCell>

      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.open(`/admin/results/${attempt.attempt_id}`, '_blank')
            }}
            className="p-2 hover:bg-gray-100 rounded"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.open(`/admin/results/${attempt.attempt_id}/review`, '_blank')
            }}
            className="p-2 hover:bg-gray-100 rounded"
            title="Edit / Regrade"
          >
            <PenSquare className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}
