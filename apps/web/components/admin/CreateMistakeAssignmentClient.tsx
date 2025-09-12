'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { QuestionFilter } from '../problem-bank/question-filter'
import type { MistakeWithQuestion } from '../../lib/types'

interface Student {
  id: string
  full_name: string
  email: string
  grade_level: number
  mistake_count: { count: number }[]
}

interface FilterOptions {
  module: string
  difficulty: string
  questionType: string
  topics: string[]
  showIncorrectOnly: boolean
}

interface CreateMistakeAssignmentClientProps {
  students: Student[]
}

export function CreateMistakeAssignmentClient({
  students,
}: CreateMistakeAssignmentClientProps) {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [mistakes, setMistakes] = useState<MistakeWithQuestion[]>([])
  const [filteredMistakes, setFilteredMistakes] = useState<
    MistakeWithQuestion[]
  >([])
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([])
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    module: 'all',
    difficulty: 'all',
    questionType: 'all',
    topics: [],
    showIncorrectOnly: false,
  })

  // Extract available topics from mistakes
  const availableTopics = useMemo(() => {
    const topics = new Set<string>()
    mistakes.forEach((mistake) => {
      if (mistake.questions?.topic_tags) {
        mistake.questions.topic_tags.forEach((tag: string) => topics.add(tag))
      }
    })
    return Array.from(topics).sort()
  }, [mistakes])

  // Filter mistakes based on current filters
  useMemo(() => {
    const filtered = mistakes.filter((mistake) => {
      const question = mistake.questions
      if (!question) return false

      // Module filter
      if (filters.module !== 'all' && question.module_type !== filters.module) {
        return false
      }

      // Difficulty filter
      if (
        filters.difficulty !== 'all' &&
        question.difficulty_level !== filters.difficulty
      ) {
        return false
      }

      // Question type filter
      if (
        filters.questionType !== 'all' &&
        question.question_type !== filters.questionType
      ) {
        return false
      }

      // Topics filter
      if (filters.topics.length > 0) {
        const questionTopics = question.topic_tags || []
        const hasMatchingTopic = filters.topics.some((topic) =>
          questionTopics.includes(topic)
        )
        if (!hasMatchingTopic) return false
      }

      return true
    })
    setFilteredMistakes(filtered)
  }, [mistakes, filters])

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleNextToMistakes = async () => {
    if (selectedStudents.length === 0) return

    setLoading(true)
    try {
      // Fetch mistakes for selected students
      const { data: studentMistakes, error } = await supabase
        .from('mistake_bank')
        .select(
          `
          id,
          user_id,
          question_id,
          status,
          first_mistaken_at,
          last_reviewed_at,
          questions!question_id (
            id,
            exam_id,
            module_type,
            question_number,
            question_type,
            difficulty_level,
            question_text,
            question_image_url,
            options,
            correct_answer,
            correct_answers,
            explanation,
            points,
            topic_tags,
            table_data,
            created_at,
            updated_at
          )
        `
        )
        .in('user_id', selectedStudents)
        .order('first_mistaken_at', { ascending: false })

      if (error) {
        console.error('Error fetching mistakes:', error)
        alert('Failed to fetch student mistakes')
        return
      }

      setMistakes((studentMistakes as unknown as MistakeWithQuestion[]) || [])
      setCurrentStep(2)
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred while fetching mistakes')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const handleMistakeToggle = (mistakeId: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(mistakeId)
        ? prev.filter((id) => id !== mistakeId)
        : [...prev, mistakeId]
    )
  }

  const handleSelectAll = () => {
    if (selectedMistakes.length === filteredMistakes.length) {
      setSelectedMistakes([])
    } else {
      setSelectedMistakes(filteredMistakes.map((mistake) => mistake.id))
    }
  }

  const handleCreateAssignment = async () => {
    if (selectedMistakes.length === 0 || !assignmentTitle.trim()) return

    setLoading(true)
    try {
      // Get question IDs from selected mistakes
      const selectedQuestionIds = mistakes
        .filter((mistake) => selectedMistakes.includes(mistake.id))
        .map((mistake) => mistake.question_id)

      // Remove duplicates
      const uniqueQuestionIds = [...new Set(selectedQuestionIds)]

      // Create a custom exam
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          title: assignmentTitle,
          description: `Custom assignment based on student mistakes (${uniqueQuestionIds.length} questions)`,
          is_mock_exam: false,
          is_active: true,
          is_custom_assignment: true,
          total_questions: uniqueQuestionIds.length,
          time_limits: {
            english1: 35 * 60,
            english2: 35 * 60,
            math1: 35 * 60,
            math2: 35 * 60,
          },
        })
        .select()
        .single()

      if (examError) {
        console.error('Error creating exam:', examError)
        alert('Failed to create assignment')
        return
      }

      // Link questions to the exam
      const examQuestions = uniqueQuestionIds.map((questionId) => ({
        exam_id: exam.id,
        question_id: questionId,
      }))

      const { error: linkError } = await supabase
        .from('exam_questions')
        .insert(examQuestions)

      if (linkError) {
        console.error('Error linking questions:', linkError)
        alert('Failed to link questions to assignment')
        return
      }

      // Create assignments for each student
      const assignments = selectedStudents.map((studentId) => ({
        exam_id: exam.id,
        student_id: studentId,
        assigned_by: null, // Will be set by RLS
        due_date: null,
        show_results: true,
        is_active: true,
      }))

      const { error: assignmentError } = await supabase
        .from('exam_assignments')
        .insert(assignments)

      if (assignmentError) {
        console.error('Error creating assignments:', assignmentError)
        alert('Failed to assign to students')
        return
      }

      alert(
        `Assignment "${assignmentTitle}" created successfully for ${selectedStudents.length} students!`
      )
      router.push('/admin/assignments')
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert('An error occurred while creating the assignment')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (currentStep === 1) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 1: Select Students
          </h2>
          <p className="text-gray-600 mb-6">
            Choose the students whose mistakes you want to use for the
            assignment.
          </p>

          {students.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Students Found
              </h3>
              <p className="text-gray-600">
                Students need to register and take exams before you can create
                mistake-based assignments.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedStudents.length} of {students.length} students
                  selected
                </p>
                <button
                  onClick={() => {
                    if (selectedStudents.length === students.length) {
                      setSelectedStudents([])
                    } else {
                      setSelectedStudents(students.map((s) => s.id))
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedStudents.length === students.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              <div className="grid gap-4 mb-6">
                {students.map((student) => {
                  const mistakeCount = student.mistake_count?.[0]?.count || 0
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedStudents.includes(student.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => handleStudentToggle(student.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {student.full_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {student.email} • Grade {student.grade_level}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {mistakeCount} mistakes
                            </p>
                            <p className="text-xs text-gray-500">available</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNextToMistakes}
                  disabled={selectedStudents.length === 0 || loading}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading
                    ? 'Loading...'
                    : `Continue with ${selectedStudents.length} students`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (currentStep === 2) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <QuestionFilter
            filters={filters}
            availableTopics={availableTopics}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Step 2: Select Mistakes & Create Assignment
                </h2>
                <p className="text-sm text-gray-600">
                  {filteredMistakes.length} mistake
                  {filteredMistakes.length !== 1 ? 's' : ''} found •{' '}
                  {selectedMistakes.length} selected
                </p>
              </div>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Back to Students
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Title
              </label>
              <input
                type="text"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                placeholder="e.g., Math Practice - Algebra & Geometry"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={filteredMistakes.length === 0}
              >
                {selectedMistakes.length === filteredMistakes.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              <button
                onClick={handleCreateAssignment}
                disabled={
                  selectedMistakes.length === 0 ||
                  !assignmentTitle.trim() ||
                  loading
                }
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Creating...'
                  : `Create Assignment (${selectedMistakes.length} questions)`}
              </button>
            </div>
          </div>

          {/* Mistakes List */}
          {filteredMistakes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">🎯</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {mistakes.length === 0
                  ? 'No mistakes found'
                  : 'No mistakes match your filters'}
              </h3>
              <p className="text-gray-600">
                {mistakes.length === 0
                  ? "The selected students haven't made any mistakes yet, or need to take more exams."
                  : 'Try adjusting your filters to see more results.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMistakes.map((mistake) => {
                const question = mistake.questions
                if (!question) return null

                return (
                  <div
                    key={mistake.id}
                    className="bg-white rounded-lg shadow border border-gray-200"
                  >
                    <div className="p-6">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedMistakes.includes(mistake.id)}
                          onChange={() => handleMistakeToggle(mistake.id)}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {question.module_type.toUpperCase()}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {question.difficulty_level}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {question.question_type.replace('_', ' ')}
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                mistake.status === 'mastered'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {mistake.status === 'mastered'
                                ? 'Mastered'
                                : 'Needs Practice'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900 mb-2">
                            {question.question_text.substring(0, 200)}
                            {question.question_text.length > 200 && '...'}
                          </div>
                          <div className="flex items-center text-xs text-gray-500 space-x-4">
                            <span>
                              First mistake:{' '}
                              {formatDate(mistake.first_mistaken_at)}
                            </span>
                            <span>
                              Worth {question.points} point
                              {question.points !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {question.topic_tags &&
                            question.topic_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {question.topic_tags.map((tag: string) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
