'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { supabase } from '../../../lib/supabase'
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
  correct_answer: string | string[]
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
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedExam, setSelectedExam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Question>>({})
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    if (user && isAdmin) {
      fetchExams()
      fetchQuestions()
    }
  }, [user, isAdmin])

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

      setExams(data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchQuestions = async (forceRefresh = false, retryCount = 0) => {
    try {
      setLoading(true)
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        if (retryCount < 2) {
          setTimeout(() => fetchQuestions(forceRefresh, retryCount + 1), 1000)
          return
        }
      }
      
      if (!session?.user) {
        if (retryCount === 0) {
          const { data: refreshed } = await supabase.auth.refreshSession()
          if (refreshed.session) {
            setTimeout(() => fetchQuestions(forceRefresh, retryCount + 1), 500)
            return
          }
        }
        setLoading(false)
        return
      }

      let query = supabase
        .from('questions')
        .select('*')
        .order('module_type', { ascending: true })
        .order('question_number', { ascending: true })

      if (selectedExam !== 'all') {
        query = query.eq('exam_id', selectedExam)
      }

      const { data, error } = await query

      if (error) {
        alert(`Error fetching questions: ${error.message}`)
        return
      }
      
      setQuestions(data || [])
    } catch (error) {
      if (retryCount < 2) {
        setTimeout(() => fetchQuestions(forceRefresh, retryCount + 1), 2000)
      }
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

      
      // Force refresh to ensure we get the latest data
      await fetchQuestions(true)
      setEditingQuestion(null)
      setEditForm({})
      alert('Question updated successfully!')
    } catch (error) {
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
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Exams</h1>
            <p className="text-gray-600">Review and edit exam questions and content</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-purple-600 mb-2">
              Search Questions
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by question text or ID..."
              className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-purple-600 mb-2">
              Exam
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            <label className="block text-sm font-medium text-purple-600 mb-2">
              Module
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Modules</option>
              <option value="english1">English 1</option>
              <option value="english2">English 2</option>
              <option value="math1">Math 1</option>
              <option value="math2">Math 2</option>
            </select>
          </div>
        </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-sm text-purple-600/70">
              Showing {filteredQuestions.length} questions
              {selectedExam !== 'all' && (
                <span className="ml-2 px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded text-xs">
                  {exams.find(exam => exam.id === selectedExam)?.title}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cards
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            
            {selectedExam !== 'all' && (
              <Link
                href={`/student/exam/${selectedExam}?preview=true`}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg"
              >
                Preview Exam
              </Link>
            )}
          </div>
        </div>

      </div>

      {/* Questions List */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100">
      {viewMode === 'table' ? (
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Question</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Module</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Difficulty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Answer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100">
                {filteredQuestions.map((question) => (
                  <tr 
                    key={question.id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-purple-900 mr-2">
                          Q{question.question_number}
                        </span>
                        <div className="max-w-md">
                          <div className="text-sm text-purple-900 truncate">
                            {renderTextWithFormattingAndMath(question.question_text.substring(0, 100) + (question.question_text.length > 100 ? '...' : ''))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded">
                        {question.module_type.replace(/(\d)/, ' $1').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-purple-900">
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
                      <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 rounded">
                        {question.correct_answer}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleEditClick(question)}
                        className="text-sm text-purple-600 hover:text-purple-800 font-medium"
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
        <div className="p-6 space-y-4">
          {filteredQuestions.map((question) => (
          <div 
            key={question.id} 
            className="border rounded-xl p-6 border-purple-200 bg-white/50 backdrop-blur-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded text-sm font-medium">
                  {question.module_type.replace(/(\d)/, ' $1').toUpperCase()} - Q{question.question_number}
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                  question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {question.difficulty_level}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-purple-800 rounded text-sm">
                  {question.question_type.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex space-x-2">
                {editingQuestion === question.id ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded text-sm hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-sm"
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
                <div className="space-y-2">
                  {question.question_type === 'multiple_choice' && question.options ? (
                    // Multiple choice: show checkboxes for each option
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Select all correct answers:</p>
                      {Object.keys(question.options).map(optionKey => {
                        const currentAnswers = Array.isArray(editForm.correct_answer) 
                          ? editForm.correct_answer 
                          : (editForm.correct_answer ? [editForm.correct_answer] : [])
                        
                        return (
                          <label key={optionKey} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={currentAnswers.includes(optionKey)}
                              onChange={(e) => {
                                const newAnswers = e.target.checked
                                  ? [...currentAnswers, optionKey]
                                  : currentAnswers.filter(a => a !== optionKey)
                                setEditForm({
                                  ...editForm, 
                                  correct_answer: newAnswers.length === 1 ? newAnswers[0] : newAnswers
                                })
                              }}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-sm">{optionKey}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    // Text input for grid-in or other types
                    <input
                      type="text"
                      value={Array.isArray(editForm.correct_answer) 
                        ? editForm.correct_answer.join(', ') 
                        : (editForm.correct_answer || '')
                      }
                      onChange={(e) => {
                        const value = e.target.value
                        const answers = value.includes(',') 
                          ? value.split(',').map(a => a.trim()).filter(a => a)
                          : [value.trim()].filter(a => a)
                        setEditForm({
                          ...editForm, 
                          correct_answer: answers.length === 1 ? answers[0] : answers
                        })
                      }}
                      placeholder="Enter answer(s), separate multiple with commas"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(question.correct_answer) ? (
                    question.correct_answer.map((answer, index) => (
                      <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                        {answer}
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                      {question.correct_answer}
                    </span>
                  )}
                </div>
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
      </div>

      {filteredQuestions.length === 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-12 text-center">
          <p className="text-purple-600/70">No questions found matching your criteria.</p>
        </div>
      )}
      </div>
    </div>
  )
}