'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { RichTextEditor } from '../../../components/rich-text-editor'

interface Question {
  id: string
  question_number: number
  module_type: string
  question_type: string
  difficulty_level: string
  question_text: string
  question_image_url?: string
  table_data?: any
  options?: any
  correct_answer: string
  explanation?: string
  topic_tags?: string[]
  exam_id?: string
}

interface Exam {
  id: string
  title: string
  description?: string
  created_at: string
}

export default function ManageExamsPage() {
  const { user, isAdmin } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedExam, setSelectedExam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Question>>({})
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showBulkTextEditor, setShowBulkTextEditor] = useState(false)
  const [bulkTextField, setBulkTextField] = useState<'question_text' | 'explanation' | 'correct_answer'>('question_text')
  const [bulkTextValue, setBulkTextValue] = useState('')

  const supabase = createClientComponentClient()

  useEffect(() => {
    if (isAdmin) {
      fetchExams()
      fetchQuestions()
    }
  }, [isAdmin])

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, description, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching exams:', error)
        return
      }

      console.log('🔍 DEBUG: Fetched exams:', data)
      setExams(data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchQuestions = async (forceRefresh = false) => {
    try {
      let query = supabase
        .from('questions')
        .select('*, exam_id')
        .order('module_type', { ascending: true })
        .order('question_number', { ascending: true })

      if (selectedExam !== 'all') {
        query = query.eq('exam_id', selectedExam)
      }

      // Add cache busting parameter for force refresh
      if (forceRefresh) {
        query = query.limit(10000) // Force a different query to bypass cache
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching questions:', error)
        return
      }

      console.log('🔄 Fetched questions:', {
        total: data?.length || 0,
        selectedExam,
        filters: { selectedModule, searchTerm }
      })
      
      setQuestions(data || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to fetch questions. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (question: Question) => {
    setEditingQuestion(question.id)
    setEditForm(question)
  }

  const handleSaveEdit = async () => {
    if (!editingQuestion || !editForm) return

    try {
      const { data, error } = await supabase
        .from('questions')
        .update({
          question_text: editForm.question_text,
          options: editForm.options,
          correct_answer: editForm.correct_answer,
          explanation: editForm.explanation,
          table_data: editForm.table_data
        })
        .eq('id', editingQuestion)
        .select()

      if (error) {
        console.error('Error updating question:', error)
        alert(`Failed to update question: ${error.message}`)
        return
      }

      console.log('✅ Question updated successfully:', data)
      
      // Force refresh to ensure we get the latest data
      await fetchQuestions(true)
      setEditingQuestion(null)
      setEditForm({})
      alert('Question updated successfully!')
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to update question. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setEditingQuestion(null)
    setEditForm({})
  }

  const renderTextWithFormattingAndMath = (text: string) => {
    if (!text) return text;
    
    const parts = [];
    let lastIndex = 0;
    
    // Combined regex for math expressions, formatting, line breaks, and dashes
    const combinedRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\*\*(.*?)\*\*|\*(.*?)\*|__(.*?)__|_(.*?)_|\^\^(.*?)\^\^|\~\~(.*?)\~\~|---|\n)/g;
    let match;
    
    while ((match = combinedRegex.exec(text)) !== null) {
      // Add text before current match
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(
            <span key={`text-${lastIndex}`}>
              {textBefore}
            </span>
          );
        }
      }
      
      const matchedContent = match[1];
      
      // Handle math expressions (simplified preview without KaTeX)
      if (matchedContent.startsWith('$')) {
        const cleanMath = matchedContent.replace(/^\$+|\$+$/g, '').trim();
        parts.push(
          <span key={`math-${match.index}`} className="bg-blue-100 px-1 rounded text-blue-800 font-mono">
            ${cleanMath}$
          </span>
        );
      }
      // Handle bold formatting **text**
      else if (match[2] !== undefined) {
        parts.push(
          <strong key={`bold-${match.index}`} className="font-bold">
            {match[2]}
          </strong>
        );
      }
      // Handle italic formatting *text*
      else if (match[3] !== undefined) {
        parts.push(
          <em key={`italic-${match.index}`} className="italic">
            {match[3]}
          </em>
        );
      }
      // Handle underline formatting __text__
      else if (match[4] !== undefined) {
        parts.push(
          <span key={`underline-${match.index}`} className="underline">
            {match[4]}
          </span>
        );
      }
      // Handle italic formatting _text_
      else if (match[5] !== undefined) {
        parts.push(
          <em key={`italic2-${match.index}`} className="italic">
            {match[5]}
          </em>
        );
      }
      // Handle superscript formatting ^^text^^
      else if (match[6] !== undefined) {
        parts.push(
          <sup key={`superscript-${match.index}`} className="text-sm">
            {match[6]}
          </sup>
        );
      }
      // Handle subscript formatting ~~text~~
      else if (match[7] !== undefined) {
        parts.push(
          <sub key={`subscript-${match.index}`} className="text-sm">
            {match[7]}
          </sub>
        );
      }
      // Handle triple dashes ---
      else if (matchedContent === '---') {
        parts.push(
          <span key={`dash-${match.index}`} className="mx-1">
            —
          </span>
        );
      }
      // Handle line breaks \n
      else if (matchedContent === '\n') {
        parts.push(
          <br key={`br-${match.index}`} />
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {remainingText}
          </span>
        );
      }
    }
    
    // If no formatting was found, return the original text
    if (parts.length === 0) {
      return text;
    }
    
    return <>{parts}</>;
  };

  const toggleQuestionSelection = (questionId: string) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId)
    } else {
      newSelected.add(questionId)
    }
    setSelectedQuestions(newSelected)
  }

  const selectAllQuestions = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)))
    }
  }

  const handleBulkUpdate = async (field: keyof Question, value: any) => {
    if (selectedQuestions.size === 0) return

    try {
      const updates = Array.from(selectedQuestions).map(questionId => 
        supabase
          .from('questions')
          .update({ [field]: value })
          .eq('id', questionId)
      )

      await Promise.all(updates)
      await fetchQuestions(true) // Force refresh
      setSelectedQuestions(new Set())
      alert(`Updated ${selectedQuestions.size} questions`)
    } catch (error) {
      console.error('Error bulk updating questions:', error)
      alert('Failed to update questions')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedQuestions.size} questions? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const deletions = Array.from(selectedQuestions).map(questionId => 
        supabase
          .from('questions')
          .delete()
          .eq('id', questionId)
      )

      await Promise.all(deletions)
      await fetchQuestions()
      setSelectedQuestions(new Set())
      alert(`Deleted ${selectedQuestions.size} questions`)
    } catch (error) {
      console.error('Error bulk deleting questions:', error)
      alert('Failed to delete questions')
    }
  }

  const handleBulkMove = async (targetExamId: string) => {
    if (selectedQuestions.size === 0) return

    try {
      const updates = Array.from(selectedQuestions).map(questionId => 
        supabase
          .from('questions')
          .update({ exam_id: targetExamId })
          .eq('id', questionId)
      )

      await Promise.all(updates)
      await fetchQuestions()
      setSelectedQuestions(new Set())
      alert(`Moved ${selectedQuestions.size} questions to selected exam`)
    } catch (error) {
      console.error('Error bulk moving questions:', error)
      alert('Failed to move questions')
    }
  }

  const handleBulkTextUpdate = async () => {
    if (selectedQuestions.size === 0 || !bulkTextValue.trim()) return

    const confirmed = confirm(`Are you sure you want to update the ${bulkTextField.replace('_', ' ')} for ${selectedQuestions.size} questions?`)
    if (!confirmed) return

    try {
      const updates = Array.from(selectedQuestions).map(questionId => 
        supabase
          .from('questions')
          .update({ [bulkTextField]: bulkTextValue })
          .eq('id', questionId)
      )

      await Promise.all(updates)
      await fetchQuestions()
      setSelectedQuestions(new Set())
      setBulkTextValue('')
      setShowBulkTextEditor(false)
      alert(`Updated ${bulkTextField.replace('_', ' ')} for ${selectedQuestions.size} questions`)
    } catch (error) {
      console.error('Error bulk updating text:', error)
      alert('Failed to update text')
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchQuestions()
    }
  }, [selectedExam, isAdmin])

  const filteredQuestions = questions.filter(question => {
    const matchesModule = selectedModule === 'all' || question.module_type === selectedModule
    const matchesSearch = question.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.id.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesModule && matchesSearch
  })

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Manage Exam Questions</h1>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Questions
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by question text or ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exam
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Module
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Modules</option>
              <option value="english1">English 1</option>
              <option value="english2">English 2</option>
              <option value="math1">Math 1</option>
              <option value="math2">Math 2</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-sm text-gray-600">
              Showing {filteredQuestions.length} questions
              {selectedExam !== 'all' && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {exams.find(exam => exam.id === selectedExam)?.title}
                </span>
              )}
              {bulkEditMode && selectedQuestions.size > 0 && (
                <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                  {selectedQuestions.size} selected
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBulkEditMode(!bulkEditMode)
                  setSelectedQuestions(new Set())
                  if (!bulkEditMode) setViewMode('table')
                }}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  bulkEditMode
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {bulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit Mode'}
              </button>
              
              {bulkEditMode && (
                <div className="flex items-center gap-1 border-l border-gray-300 pl-2">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Cards
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {bulkEditMode && selectedQuestions.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  Bulk Actions ({selectedQuestions.size})
                </button>
                
                {showBulkActions && (
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkUpdate('difficulty_level', e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      defaultValue=""
                    >
                      <option value="" disabled>Set Difficulty</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkUpdate('module_type', e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      defaultValue=""
                    >
                      <option value="" disabled>Set Module</option>
                      <option value="english1">English 1</option>
                      <option value="english2">English 2</option>
                      <option value="math1">Math 1</option>
                      <option value="math2">Math 2</option>
                    </select>
                    
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkUpdate('question_type', e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      defaultValue=""
                    >
                      <option value="" disabled>Set Type</option>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="grid_in">Grid In</option>
                    </select>
                    
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkMove(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                      defaultValue=""
                    >
                      <option value="" disabled>Move to Exam</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.title}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => setShowBulkTextEditor(!showBulkTextEditor)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit Text
                    </button>
                    
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {selectedExam !== 'all' && (
              <Link
                href={`/student/exam/${selectedExam}?preview=true`}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Preview Exam
              </Link>
            )}
          </div>
        </div>

        {bulkEditMode && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={selectAllQuestions}
                  className="px-3 py-1 text-sm bg-orange-200 hover:bg-orange-300 rounded transition-colors"
                >
                  {selectedQuestions.size === filteredQuestions.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-orange-800">
                  Click questions to select them for bulk operations
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Text Editor */}
        {showBulkTextEditor && selectedQuestions.size > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-blue-900">
                  Bulk Edit Text for {selectedQuestions.size} questions
                </h3>
                <button
                  onClick={() => setShowBulkTextEditor(false)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-blue-800">Field to update:</label>
                <select
                  value={bulkTextField}
                  onChange={(e) => setBulkTextField(e.target.value as 'question_text' | 'explanation' | 'correct_answer')}
                  className="px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="question_text">Question Text</option>
                  <option value="explanation">Explanation</option>
                  <option value="correct_answer">Correct Answer</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-blue-800">
                  New {bulkTextField.replace('_', ' ')} content:
                </label>
                <RichTextEditor
                  value={bulkTextValue}
                  onChange={setBulkTextValue}
                  placeholder={`Enter new ${bulkTextField.replace('_', ' ')} for all selected questions...`}
                  rows={6}
                  showPreview={true}
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleBulkTextUpdate}
                  disabled={!bulkTextValue.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update {selectedQuestions.size} Questions
                </button>
                <button
                  onClick={() => {
                    setBulkTextValue('')
                    setShowBulkTextEditor(false)
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Questions List */}
      {viewMode === 'table' && bulkEditMode ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
                      onChange={selectAllQuestions}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Answer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQuestions.map((question) => (
                  <tr 
                    key={question.id}
                    className={`hover:bg-gray-50 ${
                      selectedQuestions.has(question.id) ? 'bg-orange-50' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.has(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">
                          Q{question.question_number}
                        </span>
                        <div className="max-w-md">
                          <div className="text-sm text-gray-900 truncate">
                            {renderTextWithFormattingAndMath(question.question_text.substring(0, 100) + (question.question_text.length > 100 ? '...' : ''))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {question.module_type.replace(/(\d)/, ' $1').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">
                        {question.question_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                        question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.difficulty_level}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        {question.correct_answer}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleEditClick(question)}
                        className="text-sm text-violet-600 hover:text-violet-800 font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
          <div 
            key={question.id} 
            className={`bg-white border rounded-lg p-6 transition-colors ${
              bulkEditMode && selectedQuestions.has(question.id)
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                {bulkEditMode && (
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={() => toggleQuestionSelection(question.id)}
                    className="mt-1 text-orange-600 focus:ring-orange-500"
                  />
                )}
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                  {question.module_type.replace(/(\d)/, ' $1').toUpperCase()} - Q{question.question_number}
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                  question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {question.difficulty_level}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                  {question.question_type.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex space-x-2">
                {editingQuestion === question.id ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleEditClick(question)}
                    className="px-3 py-1 bg-violet-600 text-white rounded text-sm hover:bg-violet-700"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Question Content */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Question Text:</h3>
              {editingQuestion === question.id ? (
                <RichTextEditor
                  value={editForm.question_text || ''}
                  onChange={(value) => setEditForm({...editForm, question_text: value})}
                  rows={4}
                  showPreview={true}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-gray-900 leading-relaxed">{renderTextWithFormattingAndMath(question.question_text)}</div>
                </div>
              )}
            </div>

            {/* Options for Multiple Choice */}
            {question.question_type === 'multiple_choice' && question.options && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Answer Options:</h3>
                {editingQuestion === question.id ? (
                  <div className="space-y-4">
                    {Object.entries(editForm.options || {}).map(([key, value]) => {
                      let optionData;
                      try {
                        optionData = typeof value === 'string' ? JSON.parse(value) : value;
                        if (typeof optionData !== 'object') {
                          optionData = { text: String(value) };
                        }
                      } catch {
                        optionData = { text: String(value) };
                      }

                      return (
                        <div key={key} className="space-y-3 p-3 border border-gray-200 rounded">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-700 w-6">{key}.</span>
                            <span className="text-sm text-gray-600">Option {key}</span>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Text Content
                            </label>
                            <RichTextEditor
                              value={optionData.text || ''}
                              onChange={(newValue) => {
                                const updatedOption = { ...optionData, text: newValue };
                                setEditForm({
                                  ...editForm,
                                  options: {...(editForm.options || {}), [key]: JSON.stringify(updatedOption)}
                                });
                              }}
                              placeholder={`Enter text for option ${key}...`}
                              rows={2}
                              showPreview={true}
                              compact={true}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Image URL (Optional)
                            </label>
                            <input
                              type="url"
                              value={optionData.imageUrl || ''}
                              onChange={(e) => {
                                const updatedOption = { ...optionData, imageUrl: e.target.value };
                                setEditForm({
                                  ...editForm,
                                  options: {...(editForm.options || {}), [key]: JSON.stringify(updatedOption)}
                                });
                              }}
                              placeholder="https://example.com/image.jpg"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          
                          {optionData.imageUrl && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Preview
                              </label>
                              <img
                                src={optionData.imageUrl}
                                alt={`Option ${key} preview`}
                                className="max-w-full h-auto max-h-20 border border-gray-200 rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(question.options).map(([key, value]) => {
                      let optionData;
                      try {
                        optionData = typeof value === 'string' ? JSON.parse(value) : value;
                        if (typeof optionData !== 'object') {
                          optionData = { text: String(value) };
                        }
                      } catch {
                        optionData = { text: String(value) };
                      }

                      return (
                        <div key={key} className="flex items-start space-x-2">
                          <span className={`font-medium w-6 ${
                            question.correct_answer === key ? 'text-green-600' : 'text-gray-700'
                          }`}>
                            {key}.
                          </span>
                          <div className={`flex-1 ${question.correct_answer === key ? 'text-green-600 font-medium' : 'text-gray-900'}`}>
                            {optionData.text && (
                              <div className="mb-1">
                                {renderTextWithFormattingAndMath(optionData.text)}
                              </div>
                            )}
                            {optionData.imageUrl && (
                              <img
                                src={optionData.imageUrl}
                                alt={`Option ${key}`}
                                className="max-w-full h-auto max-h-20 border border-gray-200 rounded"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Correct Answer */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Correct Answer:</h3>
              {editingQuestion === question.id ? (
                <input
                  type="text"
                  value={editForm.correct_answer || ''}
                  onChange={(e) => setEditForm({...editForm, correct_answer: e.target.value})}
                  className="w-24 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              ) : (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                  {question.correct_answer}
                </span>
              )}
            </div>

            {/* Explanation */}
            {(question.explanation || editingQuestion === question.id) && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Explanation:</h3>
                {editingQuestion === question.id ? (
                  <RichTextEditor
                    value={editForm.explanation || ''}
                    onChange={(value) => setEditForm({...editForm, explanation: value})}
                    rows={3}
                    showPreview={true}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="text-gray-900 leading-relaxed">{renderTextWithFormattingAndMath(question.explanation || '')}</div>
                  </div>
                )}
              </div>
            )}

            {/* Topic Tags */}
            {question.topic_tags && question.topic_tags.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Topics:</h3>
                <div className="flex flex-wrap gap-1">
                  {question.topic_tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {filteredQuestions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No questions found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}