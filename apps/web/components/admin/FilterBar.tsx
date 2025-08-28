'use client'

import { useMemo } from 'react'
import {
  FunnelIcon,
  AcademicCapIcon,
  UserIcon,
  ChartBarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

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

interface FilterState {
  examFilter: string
  studentFilter: string
  scoreRangeFilter: string
}

interface FilterBarProps {
  attempts: AttemptData[]
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

const SCORE_RANGES = [
  { label: 'All Scores', value: '' },
  { label: '1400+ (Excellent)', value: '1400+' },
  { label: '1200-1399 (Good)', value: '1200-1399' },
  { label: '1000-1199 (Average)', value: '1000-1199' },
  { label: '800-999 (Below Average)', value: '800-999' },
  { label: 'Under 800 (Needs Work)', value: '0-799' },
]

export default function FilterBar({ attempts, filters, onFiltersChange }: FilterBarProps) {
  const uniqueExams = useMemo(() => {
    const examsSet = new Set(attempts.map(attempt => attempt.exam_title))
    return Array.from(examsSet).sort()
  }, [attempts])

  const uniqueStudents = useMemo(() => {
    const studentsMap = new Map()
    attempts.forEach(attempt => {
      if (!studentsMap.has(attempt.student_id)) {
        studentsMap.set(attempt.student_id, {
          id: attempt.student_id,
          name: attempt.student_full_name,
          email: attempt.student_email
        })
      }
    })
    return Array.from(studentsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [attempts])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      examFilter: '',
      studentFilter: '',
      scoreRangeFilter: ''
    })
  }

  const hasActiveFilters = filters.examFilter || filters.studentFilter || filters.scoreRangeFilter

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-purple-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FunnelIcon className="w-5 h-5 text-purple-600 mr-2" />
          <h4 className="text-sm font-semibold text-gray-900">Advanced Filters</h4>
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <XMarkIcon className="w-4 h-4 mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Exam Filter */}
        <div>
          <label className="flex items-center text-xs font-medium text-gray-700 mb-2">
            <AcademicCapIcon className="w-4 h-4 mr-1" />
            Filter by Exam
          </label>
          <select
            value={filters.examFilter}
            onChange={(e) => handleFilterChange('examFilter', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Exams</option>
            {uniqueExams.map((exam) => (
              <option key={exam} value={exam}>
                {exam}
              </option>
            ))}
          </select>
        </div>

        {/* Student Filter */}
        <div>
          <label className="flex items-center text-xs font-medium text-gray-700 mb-2">
            <UserIcon className="w-4 h-4 mr-1" />
            Filter by Student
          </label>
          <select
            value={filters.studentFilter}
            onChange={(e) => handleFilterChange('studentFilter', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Students</option>
            {uniqueStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.email})
              </option>
            ))}
          </select>
        </div>

        {/* Score Range Filter */}
        <div>
          <label className="flex items-center text-xs font-medium text-gray-700 mb-2">
            <ChartBarIcon className="w-4 h-4 mr-1" />
            Filter by Score Range
          </label>
          <select
            value={filters.scoreRangeFilter}
            onChange={(e) => handleFilterChange('scoreRangeFilter', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {SCORE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}