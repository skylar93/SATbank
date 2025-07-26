'use client'

import { useState } from 'react'
import { Question } from '../../lib/exam-service'
import { RichTextEditor } from '../rich-text-editor'
import { ImageUpload } from '../image-upload'
import { renderTextWithFormattingAndMath } from './question-display'

interface BulkEditPanelProps {
  questions: Question[]
  moduleType: string
  onQuestionsUpdate: (updatedQuestions: Question[]) => void
  isVisible: boolean
  onToggle: () => void
}

export function BulkEditPanel({ 
  questions, 
  moduleType, 
  onQuestionsUpdate, 
  isVisible, 
  onToggle 
}: BulkEditPanelProps) {
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [bulkEditField, setBulkEditField] = useState<'question_text' | 'explanation' | 'difficulty' | 'question_type'>('question_text')
  const [bulkEditValue, setBulkEditValue] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)))
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedQuestions.size === 0 || !bulkEditValue.trim()) return

    setSaving(true)
    try {
      const updatedQuestions = questions.map(question => {
        if (selectedQuestions.has(question.id)) {
          return {
            ...question,
            [bulkEditField]: bulkEditValue
          }
        }
        return question
      })
      
      onQuestionsUpdate(updatedQuestions)
      setSelectedQuestions(new Set())
      setBulkEditValue('')
      alert(`Updated ${selectedQuestions.size} questions`)
    } catch (error) {
      console.error('Bulk update error:', error)
      alert('Failed to update questions')
    } finally {
      setSaving(false)
    }
  }


  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={onToggle}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          📝 Bulk Edit Mode
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Bulk Edit - {moduleType.replace(/(\d)/, ' $1').toUpperCase()} ({questions.length} questions)
          </h2>
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Questions List */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Select Questions</h3>
                <button
                  onClick={selectAllQuestions}
                  className="text-sm text-orange-600 hover:text-orange-800"
                >
                  {selectedQuestions.size === questions.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              {selectedQuestions.size > 0 && (
                <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                  {selectedQuestions.size} question(s) selected
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    selectedQuestions.has(question.id)
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleQuestionSelection(question.id)}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.has(question.id)}
                      onChange={() => toggleQuestionSelection(question.id)}
                      className="mt-1 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">Q{index + 1}</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                          question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {question.difficulty_level}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {question.question_text.substring(0, 100)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bulk Edit Controls */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Bulk Edit Options</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field to Update
                  </label>
                  <select
                    value={bulkEditField}
                    onChange={(e) => setBulkEditField(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="question_text">Question Text</option>
                    <option value="explanation">Explanation</option>
                    <option value="difficulty">Difficulty Level</option>
                    <option value="question_type">Question Type</option>
                  </select>
                </div>

                {(bulkEditField === 'question_text' || bulkEditField === 'explanation') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New {bulkEditField.replace('_', ' ')} Content
                    </label>
                    <RichTextEditor
                      value={bulkEditValue}
                      onChange={setBulkEditValue}
                      placeholder={`Enter new ${bulkEditField.replace('_', ' ')} for selected questions...`}
                      rows={6}
                      showPreview={true}
                    />
                  </div>
                )}

                {bulkEditField === 'difficulty' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select difficulty...</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                )}

                {bulkEditField === 'question_type' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Type
                    </label>
                    <select
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select type...</option>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="grid_in">Grid In</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleBulkUpdate}
                    disabled={selectedQuestions.size === 0 || !bulkEditValue.trim() || saving}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Updating...' : `Update ${selectedQuestions.size} Questions`}
                  </button>
                  
                  <span className="text-sm text-gray-500">
                    {selectedQuestions.size === 0 
                      ? 'Select questions to enable bulk editing'
                      : `${selectedQuestions.size} question(s) selected`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 p-4 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
              {bulkEditValue && (bulkEditField === 'question_text' || bulkEditField === 'explanation') && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <div className="text-sm text-gray-900 leading-relaxed">
                    {renderTextWithFormattingAndMath(bulkEditValue)}
                  </div>
                </div>
              )}
              {bulkEditValue && (bulkEditField === 'difficulty' || bulkEditField === 'question_type') && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <span className={`px-2 py-1 rounded text-sm ${
                    bulkEditField === 'difficulty' 
                      ? bulkEditValue === 'easy' ? 'bg-green-100 text-green-800' :
                        bulkEditValue === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {bulkEditValue.replace('_', ' ')}
                  </span>
                </div>
              )}
              {!bulkEditValue && (
                <div className="text-sm text-gray-500 italic">
                  Select field and enter value to see preview
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}