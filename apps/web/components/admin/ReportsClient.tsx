'use client'

import { useState, useMemo } from 'react'
import { formatDuration } from '../../lib/utils'
import {
  MagnifyingGlassIcon,
  TableCellsIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import AttemptsTable from './AttemptsTable'
import StudentsTable from './StudentsTable'
import FilterBar from './FilterBar'

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

interface StudentData {
  student_id: string
  student_full_name: string
  student_email: string
  attempts: AttemptData[]
  avgScore: number
  totalAttempts: number
  lastActive: string
}

interface FilterState {
  examFilter: string
  studentFilter: string
  scoreRangeFilter: string
}

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface ReportsClientProps {
  attempts: AttemptData[]
}

export default function ReportsClient({ attempts }: ReportsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'attempts' | 'students'>('attempts')
  const [filters, setFilters] = useState<FilterState>({
    examFilter: '',
    studentFilter: '',
    scoreRangeFilter: '',
  })
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'completed_at',
    direction: 'desc',
  })

  const calculateTotalScore = (finalScores: AttemptData['final_scores']) => {
    if (!finalScores) return 0
    const englishScore = finalScores.english || 0
    const mathScore = finalScores.math || 0
    return englishScore + mathScore
  }

  const studentsData = useMemo(() => {
    if (viewMode !== 'students') return []

    const studentsMap = new Map<string, StudentData>()

    attempts.forEach((attempt) => {
      const studentId = attempt.student_id

      if (!studentsMap.has(studentId)) {
        studentsMap.set(studentId, {
          student_id: studentId,
          student_full_name: attempt.student_full_name,
          student_email: attempt.student_email,
          attempts: [],
          avgScore: 0,
          totalAttempts: 0,
          lastActive: attempt.completed_at,
        })
      }

      const studentData = studentsMap.get(studentId)!
      studentData.attempts.push(attempt)

      // Update last active if this attempt is more recent
      if (new Date(attempt.completed_at) > new Date(studentData.lastActive)) {
        studentData.lastActive = attempt.completed_at
      }
    })

    // Calculate averages and totals
    Array.from(studentsMap.values()).forEach((student) => {
      const totalScore = student.attempts.reduce((sum, attempt) => {
        return sum + calculateTotalScore(attempt.final_scores)
      }, 0)
      student.avgScore =
        student.attempts.length > 0
          ? Math.round(totalScore / student.attempts.length)
          : 0
      student.totalAttempts = student.attempts.length
    })

    return Array.from(studentsMap.values()).sort(
      (a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    )
  }, [attempts, viewMode])

  const applyScoreRangeFilter = (score: number, range: string): boolean => {
    switch (range) {
      case '1400+':
        return score >= 1400
      case '1200-1399':
        return score >= 1200 && score <= 1399
      case '1000-1199':
        return score >= 1000 && score <= 1199
      case '800-999':
        return score >= 800 && score <= 999
      case '0-799':
        return score < 800
      default:
        return true
    }
  }

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      // Text search filter
      const matchesSearch =
        !searchTerm ||
        attempt.student_full_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        attempt.student_email
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        attempt.exam_title?.toLowerCase().includes(searchTerm.toLowerCase())

      // Exam filter
      const matchesExam =
        !filters.examFilter || attempt.exam_title === filters.examFilter

      // Student filter
      const matchesStudent =
        !filters.studentFilter || attempt.student_id === filters.studentFilter

      // Score range filter
      const totalScore = calculateTotalScore(attempt.final_scores)
      const matchesScoreRange =
        !filters.scoreRangeFilter ||
        applyScoreRangeFilter(totalScore, filters.scoreRangeFilter)

      return matchesSearch && matchesExam && matchesStudent && matchesScoreRange
    })
  }, [attempts, searchTerm, filters])

  const filteredStudents = useMemo(() => {
    return studentsData.filter((student) => {
      // Text search filter
      const matchesSearch =
        !searchTerm ||
        student.student_full_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        student.student_email?.toLowerCase().includes(searchTerm.toLowerCase())

      // Student filter (for individual student selection)
      const matchesStudent =
        !filters.studentFilter || student.student_id === filters.studentFilter

      // Score range filter (based on average score)
      const matchesScoreRange =
        !filters.scoreRangeFilter ||
        applyScoreRangeFilter(student.avgScore, filters.scoreRangeFilter)

      // Exam filter (check if student has attempts for the selected exam)
      const matchesExam =
        !filters.examFilter ||
        student.attempts.some(
          (attempt) => attempt.exam_title === filters.examFilter
        )

      return matchesSearch && matchesStudent && matchesScoreRange && matchesExam
    })
  }, [studentsData, searchTerm, filters])

  // Sorting logic for attempts
  const sortedFilteredAttempts = useMemo(() => {
    const sorted = [...filteredAttempts].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'student_name':
          aValue = a.student_full_name
          bValue = b.student_full_name
          break
        case 'exam_title':
          aValue = a.exam_title
          bValue = b.exam_title
          break
        case 'total_score':
          aValue = calculateTotalScore(a.final_scores)
          bValue = calculateTotalScore(b.final_scores)
          break
        case 'english_score':
          aValue = a.final_scores?.english || 0
          bValue = b.final_scores?.english || 0
          break
        case 'math_score':
          aValue = a.final_scores?.math || 0
          bValue = b.final_scores?.math || 0
          break
        case 'duration':
          aValue = a.duration_seconds
          bValue = b.duration_seconds
          break
        case 'completed_at':
        default:
          aValue = new Date(a.completed_at)
          bValue = new Date(b.completed_at)
          break
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sorted
  }, [filteredAttempts, sortConfig])

  // Sorting logic for students
  const sortedFilteredStudents = useMemo(() => {
    const sorted = [...filteredStudents].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'student_name':
          aValue = a.student_full_name
          bValue = b.student_full_name
          break
        case 'avgScore':
          aValue = a.avgScore
          bValue = b.avgScore
          break
        case 'totalAttempts':
          aValue = a.totalAttempts
          bValue = b.totalAttempts
          break
        case 'lastActive':
        default:
          aValue = new Date(a.lastActive)
          bValue = new Date(b.lastActive)
          break
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sorted
  }, [filteredStudents, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === 'desc'
          ? 'asc'
          : 'desc',
    }))
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="space-y-4">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('attempts')}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'attempts'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableCellsIcon className="w-4 h-4 mr-2" />
              View by Attempts
            </button>
            <button
              onClick={() => setViewMode('students')}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'students'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserGroupIcon className="w-4 h-4 mr-2" />
              View by Students
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-purple-400" />
          <input
            type="text"
            placeholder={
              viewMode === 'attempts'
                ? 'Search student results...'
                : 'Search students...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        attempts={attempts}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Conditional Table Rendering */}
      {viewMode === 'attempts' ? (
        <AttemptsTable
          attempts={sortedFilteredAttempts}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      ) : (
        <StudentsTable
          students={sortedFilteredStudents}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}
    </div>
  )
}
