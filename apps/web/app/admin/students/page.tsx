'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { ExportService } from '../../../lib/export-service'
import { supabase } from '../../../lib/supabase'

interface StudentData {
  id: string
  full_name: string
  email: string
  grade_level: number | null
  target_score: number | null
  created_at: string
  attempts: {
    total: number
    completed: number
    average_score: number
    latest_score: number | null
    latest_date: string | null
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
  const [students, setStudents] = useState<StudentData[]>([])
  const [filteredStudents, setFilteredStudents] = useState<StudentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterOptions>({
    gradeLevel: 'all',
    scoreRange: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  })
  const [exporting, setExporting] = useState(false)

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
        .select('*')
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

          const completedAttempts = attempts?.filter(a => a.status === 'completed') || []
          const totalAttempts = attempts?.length || 0
          const averageScore = completedAttempts.length > 0
            ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.total_score || 0), 0) / completedAttempts.length)
            : 0
          const latestAttempt = completedAttempts.sort((a, b) => 
            new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
          )[0]

          return {
            ...student,
            attempts: {
              total: totalAttempts,
              completed: completedAttempts.length,
              average_score: averageScore,
              latest_score: latestAttempt?.total_score || null,
              latest_date: latestAttempt?.completed_at || null
            }
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
      filtered = filtered.filter(student =>
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply grade level filter
    if (filters.gradeLevel !== 'all') {
      filtered = filtered.filter(student => 
        student.grade_level === parseInt(filters.gradeLevel)
      )
    }

    // Apply score range filter
    if (filters.scoreRange !== 'all') {
      filtered = filtered.filter(student => {
        const score = student.attempts.latest_score || 0
        switch (filters.scoreRange) {
          case 'high': return score >= 1200
          case 'medium': return score >= 800 && score < 1200
          case 'low': return score > 0 && score < 800
          case 'no-tests': return student.attempts.completed === 0
          default: return true
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
          comparison = (a.attempts.latest_score || 0) - (b.attempts.latest_score || 0)
          break
        case 'attempts':
          comparison = a.attempts.completed - b.attempts.completed
          break
        case 'date':
          const dateA = a.attempts.latest_date ? new Date(a.attempts.latest_date).getTime() : 0
          const dateB = b.attempts.latest_date ? new Date(b.attempts.latest_date).getTime() : 0
          comparison = dateA - dateB
          break
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison
    })

    setFilteredStudents(filtered)
  }

  const handleExportAll = async () => {
    setExporting(true)
    try {
      // Prepare data for export
      const exportData = await Promise.all(
        filteredStudents.map(async (student) => {
          const { data: attempts } = await supabase
            .from('test_attempts')
            .select('*')
            .eq('user_id', student.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })

          return attempts?.map(attempt => ({
            student_name: student.full_name,
            email: student.email,
            grade_level: student.grade_level,
            target_score: student.target_score,
            test_date: attempt.completed_at,
            total_score: attempt.total_score,
            module_scores: attempt.module_scores,
            started_at: attempt.started_at,
            completed_at: attempt.completed_at,
            status: attempt.status
          })) || []
        })
      )

      const flattenedData = exportData.flat()
      const csvContent = ExportService.exportAdminDataToCSV(flattenedData)
      ExportService.downloadCSV(csvContent, `students-performance-${new Date().toISOString().split('T')[0]}.csv`)
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 1200) return 'text-green-600'
    if (score >= 1000) return 'text-blue-600'
    if (score >= 800) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceLevel = (score: number | null) => {
    if (!score) return 'No data'
    if (score >= 1200) return 'Excellent'
    if (score >= 1000) return 'Good'
    if (score >= 800) return 'Fair'
    return 'Needs Improvement'
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Student Management
                </h1>
                <p className="mt-2 text-gray-600">
                  Monitor individual student performance and progress
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleExportAll}
                  disabled={exporting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {exporting ? 'Exporting...' : 'Export Data'}
                </button>
                <Link
                  href="/admin/dashboard"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>

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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Search */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Students
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Grade Level Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grade Level
                    </label>
                    <select
                      value={filters.gradeLevel}
                      onChange={(e) => setFilters({...filters, gradeLevel: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Performance
                    </label>
                    <select
                      value={filters.scoreRange}
                      onChange={(e) => setFilters({...filters, scoreRange: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort By
                    </label>
                    <div className="flex">
                      <select
                        value={filters.sortBy}
                        onChange={(e) => setFilters({...filters, sortBy: e.target.value as any})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="name">Name</option>
                        <option value="score">Latest Score</option>
                        <option value="attempts">Attempts</option>
                        <option value="date">Last Test</option>
                      </select>
                      <button
                        onClick={() => setFilters({...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                        className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition-colors"
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
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-2xl font-bold text-blue-600">{filteredStudents.length}</div>
                  <div className="text-sm text-gray-500">Students Shown</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredStudents.filter(s => s.attempts.completed > 0).length}
                  </div>
                  <div className="text-sm text-gray-500">Have Taken Tests</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {filteredStudents.reduce((sum, s) => sum + s.attempts.completed, 0)}
                  </div>
                  <div className="text-sm text-gray-500">Total Completions</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(
                      filteredStudents
                        .filter(s => s.attempts.latest_score)
                        .reduce((sum, s) => sum + (s.attempts.latest_score || 0), 0) /
                      Math.max(filteredStudents.filter(s => s.attempts.latest_score).length, 1)
                    )}
                  </div>
                  <div className="text-sm text-gray-500">Average Score</div>
                </div>
              </div>

              {/* Students Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Grade & Target
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Latest Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Performance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tests Taken
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {student.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {student.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>Grade {student.grade_level || 'N/A'}</div>
                            <div className="text-gray-500">
                              Target: {student.target_score || 'None'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${getScoreColor(student.attempts.latest_score)}`}>
                              {student.attempts.latest_score || 'No tests'}
                            </div>
                            {student.attempts.latest_score && (
                              <div className="text-xs text-gray-500">
                                Avg: {student.attempts.average_score}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              student.attempts.latest_score
                                ? student.attempts.latest_score >= 1200
                                  ? 'bg-green-100 text-green-800'
                                  : student.attempts.latest_score >= 1000
                                  ? 'bg-blue-100 text-blue-800'
                                  : student.attempts.latest_score >= 800
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {getPerformanceLevel(student.attempts.latest_score)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{student.attempts.completed} completed</div>
                            <div className="text-gray-500">
                              {student.attempts.total} total
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(student.attempts.latest_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <Link
                              href={`/admin/students/${student.id}`}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              View Details
                            </Link>
                            {student.attempts.latest_score && (
                              <Link
                                href={`/student/results/${student.attempts.latest_date ? 'latest' : ''}`}
                                className="text-green-600 hover:text-green-700"
                              >
                                Latest Results
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No students found matching your criteria</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}