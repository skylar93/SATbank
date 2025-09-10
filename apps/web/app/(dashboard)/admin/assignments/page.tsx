'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import { supabase } from '../../../../lib/supabase'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserIcon,
  AcademicCapIcon,
  CalendarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface Exam {
  id: string
  title: string
  description: string
  is_active: boolean
}

interface Student {
  id: string
  full_name: string
  email: string
  grade_level: number
}

interface ExamAssignment {
  id: string
  exam_id: string
  student_id: string
  assigned_at: string
  due_date: string | null
  is_active: boolean
  show_results: boolean
  exams: Exam
  user_profiles: Student
}

export default function AdminAssignmentsPage() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<ExamAssignment[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedExams, setSelectedExams] = useState<string[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [showResults, setShowResults] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [examSearchTerm, setExamSearchTerm] = useState('')
  const [studentSearchTerm, setStudentSearchTerm] = useState('')

  // Edit assignment states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAssignment, setEditingAssignment] =
    useState<ExamAssignment | null>(null)
  const [editDueDate, setEditDueDate] = useState('')
  const [editShowResults, setEditShowResults] = useState(true)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      // First test raw access without RLS constraints for debugging

      // Load exams and students first
      const [examsData, studentsData] = await Promise.all([
        supabase.from('exams').select('*').eq('is_active', true).order('title'),
        supabase
          .from('user_profiles')
          .select('*')
          .eq('role', 'student')
          .order('full_name'),
      ])

      if (examsData.error) throw examsData.error
      if (studentsData.error) throw studentsData.error

      // Load assignments with simple query first
      const { data: rawAssignments, error: assignmentError } = await supabase
        .from('exam_assignments')
        .select('*')
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })

      let assignmentsData: { data: ExamAssignment[]; error: unknown } = {
        data: [],
        error: assignmentError,
      }

      if (!assignmentError && rawAssignments) {
        // Map assignments with exam and student data
        const enrichedAssignments = rawAssignments.map((assignment) => {
          const exam = examsData.data?.find((e) => e.id === assignment.exam_id)
          const student = studentsData.data?.find(
            (s) => s.id === assignment.student_id
          )

          return {
            ...assignment,
            exams: exam,
            user_profiles: student,
          }
        })

        assignmentsData = {
          data: enrichedAssignments as ExamAssignment[],
          error: null,
        }
      }

      setAssignments(assignmentsData.data || [])
      setExams(examsData.data || [])
      setStudents(studentsData.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAssignment = async () => {
    if (selectedExams.length === 0 || selectedStudents.length === 0) return

    try {
      let totalUpdated = 0
      let totalCreated = 0

      // Process each exam separately
      for (const examId of selectedExams) {
        // Check for existing assignments first
        const { data: existingAssignments } = await supabase
          .from('exam_assignments')
          .select('student_id')
          .eq('exam_id', examId)
          .in('student_id', selectedStudents)

        const existingStudentIds =
          existingAssignments?.map((a) => a.student_id) || []
        const newStudentIds = selectedStudents.filter(
          (id) => !existingStudentIds.includes(id)
        )

        if (existingStudentIds.length > 0) {
          // Update existing assignments
          const { error: updateError } = await supabase
            .from('exam_assignments')
            .update({
              assigned_by: user?.id,
              due_date: dueDate || null,
              show_results: showResults,
              is_active: true,
              assigned_at: new Date().toISOString(),
            })
            .eq('exam_id', examId)
            .in('student_id', existingStudentIds)

          if (updateError) throw updateError
          totalUpdated += existingStudentIds.length
        }

        if (newStudentIds.length > 0) {
          // Create new assignments
          const newAssignments = newStudentIds.map((studentId) => ({
            exam_id: examId,
            student_id: studentId,
            assigned_by: user?.id,
            due_date: dueDate || null,
            show_results: showResults,
            is_active: true,
          }))

          const { error: insertError } = await supabase
            .from('exam_assignments')
            .insert(newAssignments)

          if (insertError) throw insertError
          totalCreated += newStudentIds.length
        }
      }

      alert(
        `Assignment completed! Updated: ${totalUpdated}, Created: ${totalCreated}`
      )

      setShowAssignModal(false)
      setSelectedExams([])
      setSelectedStudents([])
      setDueDate('')
      setShowResults(true)
      setExamSearchTerm('')
      setStudentSearchTerm('')
      loadData()
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert('Error creating assignment: ' + (error as Error).message)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    try {
      const { error } = await supabase
        .from('exam_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting assignment:', error)
    }
  }

  const handleEditAssignment = (assignment: ExamAssignment) => {
    setEditingAssignment(assignment)
    setEditDueDate(
      assignment.due_date
        ? new Date(assignment.due_date).toISOString().split('T')[0]
        : ''
    )
    setEditShowResults(assignment.show_results)
    setShowEditModal(true)
  }

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return

    try {
      const { error } = await supabase
        .from('exam_assignments')
        .update({
          due_date: editDueDate || null,
          show_results: editShowResults,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', editingAssignment.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingAssignment(null)
      setEditDueDate('')
      setEditShowResults(true)
      loadData()
      alert('Assignment updated successfully!')
    } catch (error) {
      console.error('Error updating assignment:', error)
      alert('Error updating assignment: ' + (error as Error).message)
    }
  }

  const filteredAssignments = assignments.filter(
    (assignment) =>
      assignment.user_profiles?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assignment.user_profiles?.email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      assignment.exams?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredExams = exams.filter(
    (exam) =>
      exam.title.toLowerCase().includes(examSearchTerm.toLowerCase()) ||
      exam.description?.toLowerCase().includes(examSearchTerm.toLowerCase())
  )

  const filteredStudents = students.filter(
    (student) =>
      student.full_name
        .toLowerCase()
        .includes(studentSearchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
  )

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Exam Assignments
            </h1>
            <p className="text-gray-600">Assign specific exams to students</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAssignModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              New Assignment
            </button>
            <a
              href="/admin/assignments/create-from-mistakes"
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <AcademicCapIcon className="w-5 h-5 mr-2" />
              From Mistakes
            </a>
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
        {/* Search */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-purple-400" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
            <table className="min-w-full divide-y divide-purple-200">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Show Results
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-purple-100">
                {filteredAssignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserIcon className="w-8 h-8 text-purple-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {assignment.user_profiles?.full_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {assignment.user_profiles?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <AcademicCapIcon className="w-5 h-5 text-purple-500 mr-2" />
                        <div className="text-sm text-gray-900">
                          {assignment.exams?.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {assignment.due_date ? (
                        <div className="flex items-center">
                          <CalendarIcon className="w-4 h-4 mr-1" />
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </div>
                      ) : (
                        'No due date'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          assignment.show_results
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {assignment.show_results ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          assignment.is_active
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleEditAssignment(assignment)}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAssignments.length === 0 && (
              <div className="text-center py-12">
                <AcademicCapIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <p className="text-purple-600/70">No assignments found</p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Create Assignment
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Select Exams */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Exams
                </label>
                <div className="mb-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search exams..."
                      value={examSearchTerm}
                      onChange={(e) => setExamSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {filteredExams.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <AcademicCapIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      {exams.length === 0 ? (
                        <>
                          <p className="text-sm">No exams found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Please create an exam first
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm">No matching exams</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Try a different search term
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredExams.map((exam) => (
                      <label
                        key={exam.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedExams.includes(exam.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExams([...selectedExams, exam.id])
                            } else {
                              setSelectedExams(
                                selectedExams.filter((id) => id !== exam.id)
                              )
                            }
                          }}
                          className="mr-3 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {exam.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {exam.description}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Select Students */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Students
                </label>
                <div className="mb-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <UserIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      {students.length === 0 ? (
                        <>
                          <p className="text-sm">No students found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Students need to register first
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm">No matching students</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Try a different search term
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents([
                                ...selectedStudents,
                                student.id,
                              ])
                            } else {
                              setSelectedStudents(
                                selectedStudents.filter(
                                  (id) => id !== student.id
                                )
                              )
                            }
                          }}
                          className="mr-3 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {student.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {student.email} • Grade {student.grade_level}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Show Results */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Result Visibility
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="showResults"
                      checked={showResults}
                      onChange={() => setShowResults(true)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">
                      Show results to students
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="showResults"
                      checked={!showResults}
                      onChange={() => setShowResults(false)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">
                      Hide results from students
                    </span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  When hidden, students won&apos;t see their scores or access
                  the results section
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAssignment}
                disabled={
                  selectedExams.length === 0 || selectedStudents.length === 0
                }
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && editingAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Assignment
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Student Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student
                </label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">
                    {editingAssignment.user_profiles?.full_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {editingAssignment.user_profiles?.email}
                  </div>
                </div>
              </div>

              {/* Exam Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam
                </label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">
                    {editingAssignment.exams?.title}
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Show Results */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Result Visibility
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editShowResults"
                      checked={editShowResults}
                      onChange={() => setEditShowResults(true)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">Show results</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editShowResults"
                      checked={!editShowResults}
                      onChange={() => setEditShowResults(false)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">Hide results</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAssignment}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Update Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
