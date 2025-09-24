'use client'

import { useState, useTransition } from 'react'
import { updateExamCurve } from '@/lib/exam-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface ScoringCurve {
  id: number
  curve_name: string
  description?: string
}

interface CurveAssignmentControlProps {
  examId: string
  curveType: 'english' | 'math'
  currentCurveName?: string | null
  currentCurveId?: number | null
  allCurves: ScoringCurve[]
  scoringGroups?: { [key: string]: string[] }
}

export function CurveAssignmentControl({
  examId,
  curveType,
  currentCurveName,
  currentCurveId,
  allCurves,
  scoringGroups,
}: CurveAssignmentControlProps) {
  const [isPending, startTransition] = useTransition()

  // Check if this curve type is needed based on scoring groups
  const isRequired = scoringGroups ? Object.keys(scoringGroups).includes(curveType) : true

  // If not required, don't render anything
  if (!isRequired) {
    return null
  }

  // Filter curves based on type (basic filtering by curve name)
  const relevantCurves = allCurves.filter((curve) => {
    if (curveType === 'english') {
      return (
        curve.curve_name.toLowerCase().includes('reading') ||
        curve.curve_name.toLowerCase().includes('writing') ||
        curve.curve_name.toLowerCase().includes('english')
      )
    } else {
      return curve.curve_name.toLowerCase().includes('math')
    }
  })

  const handleCurveSelect = (value: string) => {
    const curveId = value === 'none' ? null : parseInt(value)
    startTransition(async () => {
      try {
        const result = await updateExamCurve(examId, curveType, curveId)
        if (!result.success) {
          alert(`Failed to update curve: ${result.message}`)
        }
      } catch (error) {
        console.error('Error updating curve:', error)
        alert('Failed to update curve. Please try again.')
      }
    })
  }

  const displayText = currentCurveName
    ? `#${currentCurveId}: ${curveType === 'english' ? 'English' : 'Math'}`
    : 'Not Assigned'

  return (
    <div className="flex items-center space-x-2">
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}

      <Select
        value={currentCurveId ? currentCurveId.toString() : 'none'}
        onValueChange={handleCurveSelect}
        disabled={isPending}
      >
        <SelectTrigger
          className={`w-auto h-auto px-3 py-1.5 text-xs font-medium rounded-full border shadow-sm ${
            currentCurveName
              ? curveType === 'english'
                ? 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border-purple-200'
                : 'bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 border-orange-200'
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}
        >
          <SelectValue placeholder="Select curve">{displayText}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not Assigned</SelectItem>
          {relevantCurves.map((curve) => (
            <SelectItem key={curve.id} value={curve.id.toString()}>
              {curve.curve_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
