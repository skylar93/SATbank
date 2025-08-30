'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
// import { ExportService } from '../../../lib/export-service'
import { supabase } from '../../../lib/supabase'
import { useImpersonation } from '../../../hooks/use-impersonation'

interface StudentData {
  id: string
  full_name: string
  email: string
  grade_level: number | null
  target_score: number | null
  show_correct_answers: boolean
  created_at: string
  attempts: {
    total: number
    completed: number
    average_score: number
    latest_score: number | null
    latest_date: string | null
    latest_attempt_id: string | null
  }
}

interface FilterOptions {
  gradeLevel: string
  scoreRange: string
  sortBy: 'name' | 'score' | 'attempts' | 'date'
  sortOrder: 'asc' | 'desc'
}

export default function AdminStudentsPage() {
  const { user } = useAuth()
  const { startImpersonation } = useImpersonation()
  const [students, setStudents] = useState<StudentData[]>([])
  const [filteredStudents, setFilteredStudents] = useState<StudentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterOptions>({
    gradeLevel: 'all',
    scoreRange: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  })
  const [updatingAnswerVisibility, setUpdatingAnswerVisibility] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (user) {
      loadStudentData()
    }
  }, [user])

  useEffect(() => {
    applyFiltersAndSort()
  }, [students, searchTerm, filters])

  const loadStudentData = async () => {
    try {
      // Get all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('user_profiles')
        .select(
          'id, full_name, email, grade_level, target_score, show_correct_answers, created_at'
        )
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      // Get attempt data for each student
      const studentsWithAttempts = await Promise.all(
        (studentsData || []).map(async (student) => {
          const { data: attempts, error: attemptsError } = await supabase
            .from('test_attempts')
            .select('*')
            .eq('user_id', student.id)

          if (attemptsError) throw attemptsError

          const completedAttempts =
            attempts?.filter((a) => a.status === 'completed') || []
          const totalAttempts = attempts?.length || 0

          // Helper function to get the display score (prefer final_scores.overall, fallback to total_score)
          const getDisplayScore = (attempt: any): number => {
            return attempt.final_scores?.overall || attempt.total_score || 0
          }

          const averageScore =
            completedAttempts.length > 0
              ? Math.round(
                  completedAttempts.reduce(
                    (sum, a) => sum + getDisplayScore(a),
                    0
                  ) / completedAttempts.length
                )
              : 0
          const latestAttempt = completedAttempts.sort(
            (a, b) =>
              new Date(b.completed_at).getTime() -
              new Date(a.completed_at).getTime()
          )[0]

          return {
            ...student,
            attempts: {
              total: totalAttempts,
              completed: completedAttempts.length,
              average_score: averageScore,
              latest_score: latestAttempt
                ? getDisplayScore(latestAttempt)
                : null,
              latest_date: latestAttempt?.completed_at || null,
              latest_attempt_id: latestAttempt?.id || null,
            },
          }
        })
      )

      setStudents(studentsWithAttempts)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...students]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
          student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply grade level filter
    if (filters.gradeLevel !== 'all') {
      filtered = filtered.filter(
        (student) => student.grade_level === parseInt(filters.gradeLevel)
      )
    }

    // Apply score range filter
    if (filters.scoreRange !== 'all') {
      filtered = filtered.filter((student) => {
        const score = student.attempts.latest_score || 0
        switch (filters.scoreRange) {
          case 'high':
            return score >= 1200
          case 'medium':
            return score >= 800 && score < 1200
          case 'low':
            return score > 0 && score < 800
          case 'no-tests':
            return student.attempts.completed === 0
          default:
            return true
        }
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (filters.sortBy) {
        case 'name':
          comparison = a.full_name.localeCompare(b.full_name)
          break
        case 'score':
          comparison =
            (a.attempts.latest_score || 0) - (b.attempts.latest_score || 0)
          break
        case 'attempts':
          comparison = a.attempts.completed - b.attempts.completed
          break
        case 'date': {
          const dateA = a.attempts.latest_date
            ? new Date(a.attempts.latest_date).getTime()
            : 0
          const dateB = b.attempts.latest_date
            ? new Date(b.attempts.latest_date).getTime()
            : 0
          comparison = dateA - dateB
          break
        }
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison
    })

    setFilteredStudents(filtered)
  }

  // Export functionality (keeping for future use)
  // const handleExportAll = async () => {
  //   try {
  //     // Prepare data for export
  //     const exportData = await Promise.all(
  //       filteredStudents.map(async (student) => {
  //         const { data: attempts } = await supabase
  //           .from('test_attempts')
  //           .select('*')
  //           .eq('user_id', student.id)
  //           .eq('status', 'completed')
  //           .order('completed_at', { ascending: false })
  //
  //         return (
  //           attempts?.map((attempt) => ({
  //             student_name: student.full_name,
  //             email: student.email,
  //             grade_level: student.grade_level,
  //             target_score: student.target_score,
  //             test_date: attempt.completed_at,
  //             total_score: attempt.total_score,
  //             module_scores: attempt.module_scores,
  //             started_at: attempt.started_at,
  //             completed_at: attempt.completed_at,
  //             status: attempt.status,
  //           })) || []
  //         )
  //       })
  //     )
  //
  //     const flattenedData = exportData.flat()
  //     const csvContent = ExportService.exportAdminDataToCSV(flattenedData)
  //     ExportService.downloadCSV(
  //       csvContent,
  //       `students-performance-${new Date().toISOString().split('T')[0]}.csv`
  //     )
  //   } catch (err: any) {
  //     setError(`Export failed: ${err.message}`)
  //   }
  // }

  const handleToggleAnswerVisibility = async (
    studentId: string,
    newValue: boolean
  ) => {
    setUpdatingAnswerVisibility(studentId)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ show_correct_answers: newValue })
        .eq('id', studentId)

      if (error) throw error

      // Update local state
      setStudents((prev) =>
        prev.map((student) =>
          student.id === studentId
            ? { ...student, show_correct_answers: newValue }
            : student
        )
      )
    } catch (err: any) {
      setError(`Failed to update answer visibility: ${err.message}`)
      // Reload data to reset the UI
      loadStudentData()
    } finally {
      setUpdatingAnswerVisibility(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 1200) return 'text-emerald-500'
    if (score >= 1000) return 'text-blue-500'
    if (score >= 800) return 'text-amber-500'
    return 'text-slate-500'
  }

  // Helper function for performance levels (keeping for future use)
  // const getPerformanceLevel = (score: number | null) => {
  //   if (!score) return 'No data'
  //   if (score >= 1200) return 'Excellent'
  //   if (score >= 1000) return 'Good'
  //   if (score >= 800) return 'Fair'
  //   return 'Needs Improvement'
  // }

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Student Management
            </h1>
            <p className="text-gray-600">
              Monitor individual student performance and progress
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student data...</p>
          </div>
        ) : (
          <>
            {/* Filters and Search */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Search Students
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Grade Level Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Grade Level
                  </label>
                  <select
                    value={filters.gradeLevel}
                    onChange={(e) =>
                      setFilters({ ...filters, gradeLevel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Grades</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                {/* Score Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Performance
                  </label>
                  <select
                    value={filters.scoreRange}
                    onChange={(e) =>
                      setFilters({ ...filters, scoreRange: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Students</option>
                    <option value="high">High (1200+)</option>
                    <option value="medium">Medium (800-1199)</option>
                    <option value="low">Low (&lt;800)</option>
                    <option value="no-tests">No Tests</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Sort By
                  </label>
                  <div className="flex">
                    <select
                      value={filters.sortBy}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          sortBy: e.target.value as any,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-purple-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="name">Name</option>
                      <option value="score">Latest Score</option>
                      <option value="attempts">Attempts</option>
                      <option value="date">Last Test</option>
                    </select>
                    <button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          sortOrder:
                            filters.sortOrder === 'asc' ? 'desc' : 'asc',
                        })
                      }
                      className="px-3 py-2 bg-purple-100 border border-l-0 border-purple-300 rounded-r-md hover:bg-purple-200 transition-colors"
                      title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                    >
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-4">
                <div className="text-2xl font-bold text-purple-500">
                  {filteredStudents.length}
                </div>
                <div className="text-sm text-gray-600">Students Shown</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-4">
                <div className="text-2xl font-bold text-violet-500">
                  {
                    filteredStudents.filter((s) => s.attempts.completed > 0)
                      .length
                  }
                </div>
                <div className="text-sm text-gray-600">Have Taken Tests</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-4">
                <div className="text-2xl font-bold text-blue-500">
                  {filteredStudents.reduce(
                    (sum, s) => sum + s.attempts.completed,
                    0
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Completions</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-4">
                <div className="text-2xl font-bold text-amber-500">
                  {Math.round(
                    filteredStudents
                      .filter((s) => s.attempts.latest_score)
                      .reduce(
                        (sum, s) => sum + (s.attempts.latest_score || 0),
                        0
                      ) /
                      Math.max(
                        filteredStudents.filter((s) => s.attempts.latest_score)
                          .length,
                        1
                      )
                  )}
                </div>
                <div className="text-sm text-gray-600">Average Score</div>
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-purple-200">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Latest Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Tests Taken
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Last Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Answer Visibility
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-purple-100">
                    {filteredStudents.map((student) => (
                      <tr
                        key={student.id}
                        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {student.full_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {student.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`text-sm font-medium ${getScoreColor(student.attempts.latest_score)}`}
                          >
                            {student.attempts.latest_score || 'No tests'}
                          </div>
                          {student.attempts.latest_score && (
                            <div className="text-xs text-gray-600">
                              Avg: {student.attempts.average_score}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{student.attempts.completed} completed</div>
                          <div className="text-gray-600">
                            {student.attempts.total} total
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(student.attempts.latest_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={student.show_correct_answers}
                              onChange={(e) =>
                                handleToggleAnswerVisibility(
                                  student.id,
                                  e.target.checked
                                )
                              }
                              disabled={updatingAnswerVisibility === student.id}
                              className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out disabled:opacity-50"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {student.show_correct_answers
                                ? 'Enabled'
                                : 'Disabled'}
                            </span>
                          </label>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Link
                            href={`/admin/students/${student.id}`}
                            className="text-purple-600 hover:text-purple-800 p-2 rounded hover:bg-purple-50"
                            title="View Details"
                          >
                            👤
                          </Link>
                          {student.attempts.latest_score &&
                            student.attempts.latest_attempt_id && (
                              <Link
                                href={`/admin/results/${student.attempts.latest_attempt_id}`}
                                className="text-violet-600 hover:text-violet-700 p-2 rounded hover:bg-violet-50"
                                title="Latest Results"
                              >
                                📊
                              </Link>
                            )}
                          <button
                            onClick={() => startImpersonation(student.id)}
                            title="View as this student"
                            className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredStudents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    No students found matching your criteria
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
