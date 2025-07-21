'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { supabase } from '../../../lib/supabase'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  UserIcon, 
  AcademicCapIcon,
  CalendarIcon,
  XMarkIcon
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
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      const [assignmentsData, examsData, studentsData] = await Promise.all([
        supabase
          .from('exam_assignments')
          .select(`
            *,
            exams(id, title, description, is_active),
            user_profiles(id, full_name, email, grade_level)
          `)
          .order('assigned_at', { ascending: false }),
        supabase
          .from('exams')
          .select('*')
          .eq('is_active', true)
          .order('title'),
        supabase
          .from('user_profiles')
          .select('*')
          .eq('role', 'student')
          .order('full_name')
      ])

      if (assignmentsData.error) throw assignmentsData.error
      if (examsData.error) throw examsData.error
      if (studentsData.error) throw studentsData.error

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
    if (!selectedExam || selectedStudents.length === 0) return

    try {
      const assignments = selectedStudents.map(studentId => ({
        exam_id: selectedExam,
        student_id: studentId,
        assigned_by: user?.id,
        due_date: dueDate || null,
        is_active: true
      }))

      const { error } = await supabase
        .from('exam_assignments')
        .insert(assignments)

      if (error) throw error

      setShowAssignModal(false)
      setSelectedExam('')
      setSelectedStudents([])
      setDueDate('')
      loadData()
    } catch (error) {
      console.error('Error creating assignment:', error)
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

  const filteredAssignments = assignments.filter(assignment =>
    assignment.user_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.user_profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.exams?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exam Assignments</h1>
              <p className="mt-2 text-gray-600">Assign specific exams to students</p>
            </div>
            <button
              onClick={() => setShowAssignModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              New Assignment
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading assignments...</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <UserIcon className="w-8 h-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.user_profiles?.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {assignment.user_profiles?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <AcademicCapIcon className="w-5 h-5 text-blue-500 mr-2" />
                          <div className="text-sm text-gray-900">
                            {assignment.exams?.title}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.assigned_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          assignment.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredAssignments.length === 0 && (
                <div className="text-center py-12">
                  <AcademicCapIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No assignments found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Assignment</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Select Exam */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Exam
                </label>
                <select
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose an exam...</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Students */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Students
                </label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {students.map((student) => (
                    <label key={student.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.id])
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                          }
                        }}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
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
                  ))}
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
                disabled={!selectedExam || selectedStudents.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}