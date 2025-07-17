'use client'

import { useState, useEffect } from 'react'
import { Question } from '../../lib/exam-service'
import { InlineMath, BlockMath } from 'react-katex'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { RichTextEditor } from '../rich-text-editor'
import { ImageUpload } from '../image-upload'

interface QuestionDisplayProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  userAnswer?: string
  onAnswerChange: (answer: string) => void
  showExplanation?: boolean
  disabled?: boolean
  isAdminPreview?: boolean
  onQuestionUpdate?: (updatedQuestion: Question) => void
  isMarkedForReview?: boolean
  onToggleMarkForReview?: () => void
}

export function QuestionDisplay({
  question,
  questionNumber,
  totalQuestions,
  userAnswer,
  onAnswerChange,
  showExplanation = false,
  disabled = false,
  isAdminPreview = false,
  onQuestionUpdate,
  isMarkedForReview = false,
  onToggleMarkForReview
}: QuestionDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localQuestion, setLocalQuestion] = useState(question)
  const [editForm, setEditForm] = useState({
    question_text: question.question_text,
    options: question.options || {},
    correct_answer: question.correct_answer,
    explanation: question.explanation || ''
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClientComponentClient()

  // Update local question when prop changes
  useEffect(() => {
    setLocalQuestion(question)
    setEditForm({
      question_text: question.question_text,
      options: question.options || {},
      correct_answer: question.correct_answer,
      explanation: question.explanation || ''
    })
  }, [question.id, question.question_text, question.options, question.correct_answer, question.explanation])

  const handleSaveEdit = async () => {
    if (!onQuestionUpdate) return
    
    // Prevent multiple simultaneous saves
    if (saving) {
      console.log('🔄 Save already in progress, skipping...')
      return
    }
    
    setSaving(true)
    let success = false
    
    try {
      console.log('🔄 Attempting to save question:', {
        questionId: question.id,
        updates: {
          question_text: editForm.question_text,
          options: editForm.options,
          correct_answer: editForm.correct_answer,
          explanation: editForm.explanation
        }
      })

      // Create a fresh supabase client instance to avoid stale state
      const freshSupabase = createClientComponentClient()
      
      // Try with explicit auth session
      const { data: { session } } = await freshSupabase.auth.getSession()
      console.log('🔍 Current session:', session ? 'Authenticated' : 'Not authenticated')

      if (!session) {
        throw new Error('No authentication session found')
      }

      // Test if we can read the question first (to check RLS policies)
      const { data: readTest, error: readError } = await freshSupabase
        .from('questions')
        .select('*')
        .eq('id', question.id)
        .single()
      
      console.log('🔍 Read test:', { readTest: !!readTest, readError })

      if (readError) {
        throw new Error(`Read test failed: ${readError.message}`)
      }

      // Match the admin panel approach exactly
      const { data, error } = await freshSupabase
        .from('questions')
        .update({
          question_text: editForm.question_text,
          options: editForm.options,
          correct_answer: editForm.correct_answer,
          explanation: editForm.explanation,
          table_data: localQuestion.table_data // Keep existing table_data
        })
        .eq('id', question.id)

      console.log('🔍 Supabase response:', { data, error })

      if (error) {
        console.error('❌ Supabase error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('✅ Question updated successfully:', data)

      // Update the local question object
      const updatedQuestion = {
        ...localQuestion,
        question_text: editForm.question_text,
        options: editForm.options,
        correct_answer: editForm.correct_answer,
        explanation: editForm.explanation
      }
      
      setLocalQuestion(updatedQuestion)
      
      // Call the callback to update the parent state (exam state)
      if (onQuestionUpdate) {
        onQuestionUpdate(updatedQuestion)
      }
      
      setIsEditing(false)
      success = true
      alert('Question saved successfully!')
      
    } catch (error) {
      console.error('❌ Unexpected error saving question:', error)
      alert(`Failed to save question: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaving(false)
      console.log('🔄 Save process completed, success:', success)
    }
  }

  const handleCancelEdit = () => {
    setEditForm({
      question_text: localQuestion.question_text,
      options: localQuestion.options || {},
      correct_answer: localQuestion.correct_answer,
      explanation: localQuestion.explanation || ''
    })
    setIsEditing(false)
  }

  const renderTextWithFormattingAndMath = (text: string) => {
    if (!text) return text;
    
    const parts = [];
    let lastIndex = 0;
    
    // Combined regex for math expressions, formatting, line breaks, dashes, long blanks, and images
    const combinedRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|!\[(.*?)\]\((.*?)\)|\*\*(.*?)\*\*|\*(.*?)\*|_{5,}|__(.*?)__|_(.*?)_|\^\^(.*?)\^\^|\~\~(.*?)\~\~|---|\\n|\n)/g;
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
      
      // Handle math expressions
      if (matchedContent.startsWith('$')) {
        const isBlock = matchedContent.startsWith('$$');
        const cleanMath = matchedContent.replace(/^\$+|\$+$/g, '').trim();
        
        try {
          if (isBlock) {
            parts.push(
              <div key={`math-${match.index}`} className="my-4">
                <BlockMath math={cleanMath} />
              </div>
            );
          } else {
            parts.push(
              <InlineMath key={`math-${match.index}`} math={cleanMath} />
            );
          }
        } catch (error) {
          console.error('KaTeX render error:', error);
          parts.push(
            <span key={`fallback-${match.index}`} className="text-red-500">
              {matchedContent}
            </span>
          );
        }
      }
      // Handle markdown images ![alt](url)
      else if (match[2] !== undefined && match[3] !== undefined) {
        parts.push(
          <img 
            key={`image-${match.index}`} 
            src={match[3]} 
            alt={match[2]} 
            className="max-w-full h-auto my-2 border border-gray-200 rounded"
          />
        );
      }
      // Handle bold formatting **text**
      else if (match[4] !== undefined) {
        parts.push(
          <strong key={`bold-${match.index}`} className="font-bold">
            {match[4]}
          </strong>
        );
      }
      // Handle italic formatting *text*
      else if (match[5] !== undefined) {
        parts.push(
          <em key={`italic-${match.index}`} className="italic">
            {match[5]}
          </em>
        );
      }
      // Handle underline formatting __text__
      else if (match[6] !== undefined) {
        parts.push(
          <span key={`underline-${match.index}`} className="underline">
            {match[6]}
          </span>
        );
      }
      // Handle italic formatting _text_
      else if (match[7] !== undefined) {
        parts.push(
          <em key={`italic2-${match.index}`} className="italic">
            {match[7]}
          </em>
        );
      }
      // Handle superscript formatting ^^text^^
      else if (match[8] !== undefined) {
        parts.push(
          <sup key={`superscript-${match.index}`} className="text-sm">
            {match[8]}
          </sup>
        );
      }
      // Handle subscript formatting ~~text~~
      else if (match[9] !== undefined) {
        parts.push(
          <sub key={`subscript-${match.index}`} className="text-sm">
            {match[9]}
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
      // Handle long blanks (5 or more underscores)
      else if (matchedContent.match(/_{5,}/)) {
        const blankLength = matchedContent.length;
        parts.push(
          <span 
            key={`blank-${match.index}`} 
            className="inline-block border-b border-gray-800 mx-1"
            style={{ width: `${blankLength * 0.6}em`, minWidth: `${blankLength * 0.6}em` }}
          >
            &nbsp;
          </span>
        );
      }
      // Handle line breaks \n and literal \n
      else if (matchedContent === '\n' || matchedContent === '\\n') {
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

  const renderTable = (tableData: any, isCompact = false) => {
    if (!tableData || !tableData.headers || !tableData.rows) return null;
    
    return (
      <div className={isCompact ? "mt-2 mb-2" : "mt-4 mb-4"}>
        <table className={`w-full border-collapse border border-gray-300 bg-white ${isCompact ? 'text-sm' : ''}`}>
          <thead>
            <tr className="bg-gray-50">
              {tableData.headers.map((header: string, i: number) => (
                <th key={i} className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-left font-semibold text-gray-900`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: string[], i: number) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell: string, j: number) => (
                  <td key={j} className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-gray-900`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  const renderAnswerChoiceContent = (value: string) => {
    // Try to parse as JSON to check if it's table data or has image URL
    try {
      const parsed = JSON.parse(value);
      if (parsed.table_data && parsed.table_data.headers && parsed.table_data.rows) {
        return renderTable(parsed.table_data, true);
      }
      // Check if it has both text and imageUrl
      if (parsed.text || parsed.imageUrl) {
        return (
          <div className="space-y-2">
            {parsed.text && (
              <div>{renderTextWithFormattingAndMath(parsed.text)}</div>
            )}
            {parsed.imageUrl && (
              <img
                src={parsed.imageUrl}
                alt="Answer choice image"
                className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
              />
            )}
          </div>
        );
      }
    } catch (e) {
      // Not JSON, continue with regular text rendering
    }
    
    // Check if it's a simple image URL
    if (typeof value === 'string' && (value.startsWith('http') && (value.includes('.jpg') || value.includes('.png') || value.includes('.jpeg') || value.includes('.gif') || value.includes('.svg')))) {
      return (
        <img
          src={value}
          alt="Answer choice image"
          className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
        />
      );
    }
    
    // Regular text rendering with formatting
    return renderTextWithFormattingAndMath(value);
  };
  
  const renderAnswerOptions = () => {
    if (localQuestion.question_type === 'multiple_choice' && localQuestion.options) {
      if (isEditing) {
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Options
            </label>
            {Object.entries(editForm.options).map(([key, value]) => {
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
                <div key={key} className="space-y-3 p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-8">{key}.</span>
                    <span className="text-sm text-gray-600">Option {key}</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Text Content
                    </label>
                    <RichTextEditor
                      value={optionData.text || ''}
                      onChange={(newValue) => {
                        const updatedOption = { ...optionData, text: newValue };
                        setEditForm({
                          ...editForm,
                          options: {...editForm.options, [key]: JSON.stringify(updatedOption)}
                        });
                      }}
                      placeholder={`Enter text for option ${key}...`}
                      rows={2}
                      showPreview={true}
                      compact={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={optionData.imageUrl || ''}
                      onChange={(e) => {
                        const updatedOption = { ...optionData, imageUrl: e.target.value };
                        setEditForm({
                          ...editForm,
                          options: {...editForm.options, [key]: JSON.stringify(updatedOption)}
                        });
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Or upload an image:
                      </label>
                      <ImageUpload
                        onImageUploaded={(imageUrl) => {
                          const updatedOption = { ...optionData, imageUrl };
                          setEditForm({
                            ...editForm,
                            options: {...editForm.options, [key]: JSON.stringify(updatedOption)}
                          });
                        }}
                        maxSize={2}
                      />
                    </div>
                  </div>
                  
                  {optionData.imageUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preview
                      </label>
                      <img
                        src={optionData.imageUrl}
                        alt={`Option ${key} preview`}
                        className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
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
        )
      }

      return (
        <div className="space-y-3">
          {Object.entries(localQuestion.options).map(([key, value]) => (
            <label
              key={key}
              className={`
                flex items-start p-3 rounded-lg transition-all
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${userAnswer === key 
                  ? 'bg-blue-50 border-2 border-blue-500 ring-1 ring-blue-200' 
                  : disabled 
                    ? 'bg-gray-50 border-2 border-gray-200'
                    : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${showExplanation && localQuestion.correct_answer === key
                  ? 'bg-green-50 border-green-500'
                  : ''
                }
                ${showExplanation && userAnswer === key && localQuestion.correct_answer !== key
                  ? 'bg-red-50 border-red-500'
                  : ''
                }
              `}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={key}
                checked={userAnswer === key}
                onChange={(e) => onAnswerChange(e.target.value)}
                className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                disabled={showExplanation || disabled}
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="font-semibold text-gray-700 mr-2">{key}.</span>
                  {showExplanation && localQuestion.correct_answer === key && (
                    <span className="text-green-600 text-sm font-medium">✓ Correct</span>
                  )}
                  {showExplanation && userAnswer === key && localQuestion.correct_answer !== key && (
                    <span className="text-red-600 text-sm font-medium">✗ Incorrect</span>
                  )}
                </div>
                <div className="text-gray-900 leading-relaxed">{renderAnswerChoiceContent(String(value))}</div>
              </div>
            </label>
          ))}
        </div>
      )
    }

    if (localQuestion.question_type === 'grid_in') {
      return (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              Enter your answer in the box below. For fractions, enter as "3/4". For decimals, use "0.75".
            </p>
            <input
              type="text"
              value={userAnswer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              className={`w-full p-3 text-lg font-mono border-2 rounded-lg ${
                disabled || showExplanation 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
              }`}
              placeholder="Enter your answer"
              disabled={showExplanation || disabled}
            />
          </div>
          {showExplanation && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Correct Answer:</strong> {localQuestion.correct_answer}
              </p>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="h-full flex flex-col lg:flex-row bg-white">
      {/* Question Content Area */}
      <div className="flex-1 lg:w-1/2 p-6 lg:pr-3 border-b lg:border-b-0 lg:border-r border-gray-200">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Question {questionNumber} of {totalQuestions}
            </h2>
            <div className="flex items-center space-x-2">
              {!isAdminPreview && !showExplanation && onToggleMarkForReview && (
                <button
                  onClick={onToggleMarkForReview}
                  disabled={disabled}
                  className={`
                    px-3 py-1 text-xs font-medium rounded transition-colors
                    ${isMarkedForReview
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isMarkedForReview ? '🏷️ Marked for Review' : '🏷️ Mark for Review'}
                </button>
              )}
              {isAdminPreview && (
                <>
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${localQuestion.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' : ''}
                    ${localQuestion.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${localQuestion.difficulty_level === 'hard' ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {localQuestion.difficulty_level}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {localQuestion.module_type.replace(/(\d)/, ' $1').toUpperCase()}
                  </span>
                </>
              )}
              {isAdminPreview && (
                <div className="flex space-x-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors"
                    >
                      Edit Question
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {isAdminPreview && localQuestion.topic_tags && localQuestion.topic_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {localQuestion.topic_tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="prose prose-gray max-w-none">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text
                </label>
                <RichTextEditor
                  value={editForm.question_text}
                  onChange={(value) => setEditForm({...editForm, question_text: value})}
                  placeholder="Enter question text..."
                  rows={6}
                  showPreview={true}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Image Upload
                </label>
                <ImageUpload
                  onImageUploaded={(imageUrl) => {
                    // Add the image URL to the question text
                    const newText = editForm.question_text + `\n\n![Question Image](${imageUrl})`;
                    setEditForm({...editForm, question_text: newText});
                  }}
                  className="mb-2"
                />
                <p className="text-xs text-gray-500">
                  Upload an image that will be inserted into the question text. You can also manually add image URLs in markdown format: ![alt text](image-url)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correct Answer
                </label>
                <input
                  type="text"
                  value={editForm.correct_answer}
                  onChange={(e) => setEditForm({...editForm, correct_answer: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Correct answer (e.g., A, B, C, D or numeric value)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation (Optional)
                </label>
                <RichTextEditor
                  value={editForm.explanation}
                  onChange={(value) => setEditForm({...editForm, explanation: value})}
                  placeholder="Explain the correct answer..."
                  rows={3}
                  showPreview={true}
                />
              </div>
            </div>
          ) : (
            <div className="text-gray-900 leading-relaxed">
              {renderTextWithFormattingAndMath(localQuestion.question_text)}
            </div>
          )}
          
          {!isEditing && localQuestion.question_image_url && (
            <div className="mt-4">
              <img
                src={localQuestion.question_image_url}
                alt="Question diagram or image"
                className="max-w-full h-auto border border-gray-200 rounded"
              />
            </div>
          )}
          
          {!isEditing && localQuestion.table_data && renderTable(localQuestion.table_data)}
        </div>
      </div>

      {/* Answer Selection Area */}
      <div className="flex-1 lg:w-1/2 p-6 lg:pl-3">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {localQuestion.question_type === 'multiple_choice' ? 'Select your answer:' : 'Enter your answer:'}
          </h3>
          
          {renderAnswerOptions()}
        </div>

        {/* Answer Status */}
        {userAnswer && !showExplanation && (
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {userAnswer}
            </p>
          </div>
        )}

        {/* Explanation (if showing results) */}
        {showExplanation && localQuestion.explanation && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Explanation:</h4>
            <div className="text-gray-700 leading-relaxed">{renderTextWithFormattingAndMath(localQuestion.explanation)}</div>
          </div>
        )}
      </div>
    </div>
  )
}