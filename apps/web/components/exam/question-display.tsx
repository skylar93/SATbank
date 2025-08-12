'use client'

import { useState, useEffect } from 'react'
import { Question } from '../../lib/exam-service'
import { InlineMath, BlockMath } from 'react-katex'
import { supabase } from '../../lib/supabase'
import { RichTextEditor } from '../rich-text-editor'
// import { WysiwygEditor } from '../wysiwyg-editor' // KEEPING COMMENTED OUT - HTML conversion functionality removed
import { ImageUpload } from '../image-upload'
import { HelpCircle } from 'lucide-react'

// Shared text rendering function
export const renderTextWithFormattingAndMath = (text: string) => {
  if (!text) return text;
  
  // First, handle escaped dollar signs by replacing \$ with a unique placeholder
  const escapedDollarPlaceholder = '§§§DOLLAR§§§';
  let processedText = text.replace(/\\\$/g, escapedDollarPlaceholder);
  
  // Function to restore escaped dollars in final output
  const restoreEscapedDollars = (content: any): any => {
    if (typeof content === 'string') {
      return content.replace(new RegExp(escapedDollarPlaceholder.replace(/\§/g, '\\§'), 'g'), '$');
    }
    return content;
  };
  
  const parts = [];
  let lastIndex = 0;
  
  // Combined regex for tables, positioned images, math expressions, formatting, line breaks, dashes, long blanks, center alignment, and images
  // CRITICAL: _{5,} MUST be first among underscore patterns to get priority
  const combinedRegex = /({{table}}[\s\S]*?{{\/table}}|{{img-(left|center|right)}}!\[(.*?)\]\((.*?)\){{\/img-(left|center|right)}}|_{5,}|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|::(.*?)::|!\[(.*?)\]\((.*?)\)|\*\*(.*?)\*\*|\*(.*?)\*|__([^_]*?)__|_([^_]*?)_|\^\^(.*?)\^\^|\~\~(.*?)\~\~|---|--|\\n|\n)/g;
  
  let match: RegExpExecArray | null;
  
  while ((match = combinedRegex.exec(processedText)) !== null) {
    // Add text before current match
    if (match.index > lastIndex) {
      const textBefore = processedText.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {restoreEscapedDollars(textBefore)}
          </span>
        );
      }
    }
    
    const matchedContent = match[1];
    
    // Handle tables
    if (matchedContent.startsWith('{{table}}')) {
      const tableContent = matchedContent.replace(/{{table}}|{{\/table}}/g, '').trim();
      const lines = tableContent.split('\n').filter(line => line.trim());
      
      if (lines.length >= 3) {
        const headers = lines[0].split('|').map(h => h.trim());
        const rows = lines.slice(2).map(line => line.split('|').map(cell => cell.trim()));
        
        parts.push(
          <div key={`table-${match.index}`} className="my-4 overflow-x-auto max-w-full">
            <table className="w-full border-collapse border border-gray-300 bg-white">
              <thead>
                <tr className="bg-gray-50">
                  {headers.map((header, i) => (
                    <th key={i} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900 break-words">
                      {renderTextWithFormattingAndMath(restoreEscapedDollars(header))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, j) => (
                      <td key={j} className="border border-gray-300 px-4 py-2 text-gray-900 break-words">
                        {renderTextWithFormattingAndMath(restoreEscapedDollars(cell))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }
    // Handle positioned images
    else if (match[2] && match[3] && match[4]) {
      const position = match[2];
      const alt = match[3];
      const url = match[4];
      
      const alignmentClass = position === 'left' ? 'text-left' : 
                            position === 'right' ? 'text-right' : 'text-center';
      
      parts.push(
        <div key={`positioned-image-${match.index}`} className={`my-4 ${alignmentClass}`}>
          <img 
            src={url} 
            alt={restoreEscapedDollars(alt)}
            className="max-w-full h-auto border border-gray-200 rounded inline-block"
            onError={(e) => {
              console.error('Image failed to load:', url);
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    }
    // Handle long blanks (5 or more underscores) - MUST BE FIRST
    else if (matchedContent.match(/_{5,}/)) {
      const blankLength = matchedContent.length;
      parts.push(
        <span 
          key={`blank-${match.index}`} 
          style={{ 
            display: 'inline-block',
            width: `${Math.max(blankLength * 0.8, 3)}em`,
            minWidth: '3em',
            borderBottom: '1px solid #374151',
            height: '1.2em',
            marginBottom: '1px'
          }}
        >
          &nbsp;
        </span>
      );
    }
    // Handle center alignment ::text::
    else if (match[6] !== undefined) {
      parts.push(
        <div key={`center-${match.index}`} className="text-center my-2">
          {renderTextWithFormattingAndMath(restoreEscapedDollars(match[6]))}
        </div>
      );
    }
    // Handle math expressions (but not if they contain escaped dollars)
    else if (matchedContent.startsWith('$') && !matchedContent.includes(escapedDollarPlaceholder)) {
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
    else if (match[7] !== undefined && match[8] !== undefined) {
      const imageUrl = match[8];
      const imageAlt = match[7];
      parts.push(
        <img 
          key={`image-${match.index}`} 
          src={imageUrl} 
          alt={restoreEscapedDollars(imageAlt)} 
          className="max-w-full h-auto my-2 border border-gray-200 rounded"
          onError={(e) => {
            console.error('Image failed to load:', imageUrl);
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }
    // Handle bold formatting **text**
    else if (match[9] !== undefined) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold">
          {restoreEscapedDollars(match[9])}
        </strong>
      );
    }
    // Handle italic formatting *text*
    else if (match[10] !== undefined) {
      parts.push(
        <em key={`italic-${match.index}`} className="italic">
          {restoreEscapedDollars(match[10])}
        </em>
      );
    }
    // Handle underline formatting __text__
    else if (match[11] !== undefined) {
      parts.push(
        <span key={`underline-${match.index}`} className="underline">
          {restoreEscapedDollars(match[11])}
        </span>
      );
    }
    // Handle italic formatting _text_
    else if (match[12] !== undefined) {
      parts.push(
        <em key={`italic2-${match.index}`} className="italic">
          {restoreEscapedDollars(match[12])}
        </em>
      );
    }
    // Handle superscript formatting ^^text^^
    else if (match[13] !== undefined) {
      parts.push(
        <sup key={`superscript-${match.index}`} className="text-sm">
          {restoreEscapedDollars(match[13])}
        </sup>
      );
    }
    // Handle subscript formatting ~~text~~
    else if (match[14] !== undefined) {
      parts.push(
        <sub key={`subscript-${match.index}`} className="text-sm">
          {restoreEscapedDollars(match[14])}
        </sub>
      );
    }
    // Handle dashes --- and --
    else if (matchedContent === '---' || matchedContent === '--') {
      parts.push(
        <span key={`dash-${match.index}`} className="inline">
          —
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
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex);
    if (remainingText) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {restoreEscapedDollars(remainingText)}
        </span>
      );
    }
  }
  
  // If no formatting was found, return the original text with escaped dollars processed
  if (parts.length === 0) {
    return restoreEscapedDollars(processedText);
  }
  
  return <>{parts}</>;
};

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
    question_type: question.question_type,
    options: question.options || {},
    correct_answer: question.correct_answer,
    explanation: question.explanation || '',
    table_data: question.table_data || null
  })
  const [saving, setSaving] = useState(false)
  const [showFormattingHelp, setShowFormattingHelp] = useState(false)
  const [showAnswerCheck, setShowAnswerCheck] = useState(false)

  // Update local question when prop changes
  useEffect(() => {
    setLocalQuestion(question)
    setEditForm({
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options || {},
      correct_answer: question.correct_answer,
      explanation: question.explanation || '',
      table_data: question.table_data || null
    })
    // Reset answer check when question changes
    setShowAnswerCheck(false)
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

      // Check authentication session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🔍 Current session:', session ? 'Authenticated' : 'Not authenticated')

      if (!session) {
        throw new Error('No authentication session found')
      }

      // Test if we can read the question first (to check RLS policies)
      const { data: readTest, error: readError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', question.id)
        .single()
      
      console.log('🔍 Read test:', { readTest: !!readTest, readError })

      if (readError) {
        throw new Error(`Read test failed: ${readError.message}`)
      }

      // Match the admin panel approach exactly
      const { data, error } = await supabase
        .from('questions')
        .update({
          question_text: editForm.question_text,
          question_type: editForm.question_type,
          options: editForm.options,
          correct_answer: editForm.correct_answer,
          explanation: editForm.explanation,
          table_data: editForm.table_data
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
        question_type: editForm.question_type,
        options: editForm.options,
        correct_answer: editForm.correct_answer,
        explanation: editForm.explanation,
        table_data: editForm.table_data
      }
      
      setLocalQuestion(updatedQuestion)
      
      // Call the callback to update the parent state (exam state)
      if (onQuestionUpdate) {
        onQuestionUpdate(updatedQuestion)
      }
      
      setIsEditing(false)
      success = true
      console.log('✅ Question saved successfully!')
      
    } catch (error) {
      console.error('❌ Unexpected error saving question:', error)
      console.error(`❌ Failed to save question: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaving(false)
      console.log('🔄 Save process completed, success:', success)
    }
  }

  const handleCancelEdit = () => {
    setEditForm({
      question_text: localQuestion.question_text,
      question_type: localQuestion.question_type,
      options: localQuestion.options || {},
      correct_answer: localQuestion.correct_answer,
      explanation: localQuestion.explanation || '',
      table_data: localQuestion.table_data || null
    })
    setIsEditing(false)
  }



  const renderTable = (tableData: any, isCompact = false) => {
    if (!tableData || !tableData.headers || !tableData.rows) return null;
    
    return (
      <div className={`${isCompact ? "mt-2 mb-2" : "mt-4 mb-4"} overflow-x-auto max-w-full`}>
        <table className={`w-full border-collapse border border-gray-300 bg-white ${isCompact ? 'text-sm' : ''}`}>
          <thead>
            <tr className="bg-gray-50">
              {tableData.headers.map((header: string, i: number) => (
                <th key={i} className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-left font-semibold text-gray-900 break-words`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: string[], i: number) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell: string, j: number) => (
                  <td key={j} className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-gray-900 break-words`}>
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
    // Handle null, undefined, or non-string values
    if (!value || typeof value !== 'string') {
      return <span className="text-gray-500 italic">No content</span>;
    }

    // Only try to parse as JSON if it looks like JSON (starts with { or [)
    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
      
      // Check for direct table data in the parsed JSON
      if (parsed.table_data && parsed.table_data.headers && parsed.table_data.rows) {
        return renderTable(parsed.table_data, true);
      }
      
      // Check if the parsed value itself is table data
      if (parsed.headers && parsed.rows) {
        return renderTable(parsed, true);
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
                onError={(e) => {
                  console.error('Answer choice image failed to load:', parsed.imageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        );
      }

      // If it's a valid JSON object but doesn't match expected structures,
      // try to convert it back to a readable format
      if (typeof parsed === 'object') {
        // If it looks like table data structure, try to render it
        if (Array.isArray(parsed)) {
          return (
            <div className="text-sm">
              {parsed.map((item, index) => (
                <div key={index}>{String(item)}</div>
              ))}
            </div>
          );
        }
        
        // For other objects, display as formatted text
        return (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
            <div className="font-medium">Object content detected:</div>
            <pre className="text-xs mt-1 whitespace-pre-wrap">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      }
      
        // If parsed is a string or primitive, use it directly
        return renderTextWithFormattingAndMath(String(parsed));
        
      } catch (e) {
        // Not JSON, continue with regular text rendering
      }
    }
    
    // Check if it's a simple image URL
    if (typeof value === 'string' && (value.startsWith('http') && (value.includes('.jpg') || value.includes('.png') || value.includes('.jpeg') || value.includes('.gif') || value.includes('.svg')))) {
      return (
        <img
          src={value}
          alt="Answer choice image"
          className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
          onError={(e) => {
            console.error('Simple image URL failed to load:', value);
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }
    
    // Regular text rendering with formatting
    return renderTextWithFormattingAndMath(value);
  };
  
  const renderAnswerOptions = () => {
    if (localQuestion.question_type === 'multiple_choice' || isEditing) {
      if (isEditing) {
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Options
            </label>
            
            {/* Show message if no options exist yet */}
            {(!editForm.options || Object.keys(editForm.options).length === 0) && (
              <div className="text-center p-4 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <p className="text-gray-600 text-sm mb-2">No answer choices found for this question.</p>
                <p className="text-gray-500 text-xs">Click "Add Answer Choice" below to create new options.</p>
              </div>
            )}
            
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
                <div key={key} className="space-y-3 p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-8">{key}.</span>
                      <span className="text-sm text-gray-600">Option {key}</span>
                    </div>
                    <button
                      onClick={() => {
                        const newOptions = { ...(editForm.options || {}) };
                        delete newOptions[key];
                        setEditForm({
                          ...editForm,
                          options: newOptions
                        });
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
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
                          options: {...(editForm.options || {}), [key]: JSON.stringify(updatedOption)}
                        });
                      }}
                      placeholder={`Enter text for option ${key}...`}
                      rows={3}
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
                          options: {...(editForm.options || {}), [key]: JSON.stringify(updatedOption)}
                        });
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {optionData.imageUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
            
            {/* Add New Option Button */}
            <div className="text-center">
              <button
                onClick={() => {
                  const currentOptions = editForm.options || {};
                  const existingKeys = Object.keys(currentOptions);
                  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                  const nextKey = letters.find(letter => !existingKeys.includes(letter)) || 'A';
                  
                  const newOptions = {
                    ...currentOptions,
                    [nextKey]: JSON.stringify({ text: '' })
                  };
                  
                  setEditForm({
                    ...editForm,
                    options: newOptions
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + Add Answer Choice
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-3">
          {Object.entries(localQuestion.options || {}).map(([key, value]) => (
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
                <div className="text-gray-900 leading-relaxed">
                  {(() => {
                    
                    // Handle cases where value is already an object (not a string)
                    if (typeof value === 'object' && value !== null) {
                      
                      const objValue = value as any; // Type assertion to fix TypeScript error
                      
                      // Check if it has table structure
                      if (objValue.headers && objValue.rows) {
                        return renderTable(objValue, true);
                      }
                      
                      // Check if it has nested table_data
                      if (objValue.table_data && objValue.table_data.headers && objValue.table_data.rows) {
                        return renderTable(objValue.table_data, true);
                      }
                      
                      // Check for text/image content
                      if (objValue.text || objValue.imageUrl) {
                        return (
                          <div className="space-y-2">
                            {objValue.text && (
                              <div>{renderTextWithFormattingAndMath(objValue.text)}</div>
                            )}
                            {objValue.imageUrl && (
                              <img
                                src={objValue.imageUrl}
                                alt="Answer choice image"
                                className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
                                onError={(e) => {
                                  console.error('Answer option object image failed to load:', objValue.imageUrl);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        );
                      }
                      
                      // Fallback for unrecognized object structure
                      return (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
                          <div className="font-medium">Debug: Object detected in option {key}</div>
                          <pre className="text-xs mt-1 whitespace-pre-wrap">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                    
                    // Handle string values normally
                    return renderAnswerChoiceContent(String(value));
                  })()}
                </div>
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
      <div className="flex-1 lg:w-1/2 p-6 lg:pr-3 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 truncate" title={`Question ${questionNumber} of ${totalQuestions}`}>
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

        <div className="prose prose-gray max-w-none overflow-hidden">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Question Text
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFormattingHelp(!showFormattingHelp)}
                    className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title="Formatting Help"
                  >
                    <HelpCircle size={16} />
                  </button>
                </div>
                
                {showFormattingHelp && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-gray-700">
                    <div className="font-semibold mb-2">Formatting Guide:</div>
                    <div className="space-y-1">
                      <div><strong>Text:</strong> **bold** *italic* __underline__ ^^superscript^^ ~~subscript~~ ::center::</div>
                      <div><strong>Special:</strong> --- (em dash) _______ (long blank) \n (line break)</div>
                      <div><strong>Math:</strong> $x^2$ (inline) $$x^2$$ (block equations)</div>
                      <div><strong>Tables:</strong> Use Table button to insert editable tables</div>
                      <div><strong>Images:</strong> Use Image button for positioned images (left/center/right)</div>
                    </div>
                  </div>
                )}
                
                <RichTextEditor
                  value={editForm.question_text}
                  onChange={(value) => setEditForm({...editForm, question_text: value})}
                  placeholder="Enter question text..."
                  rows={8}
                  showPreview={true}
                />
              </div>
              
              {editForm.table_data && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Table Data
                  </label>
                  <div className="space-y-4 p-4 border border-gray-300 rounded-md bg-gray-50">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Headers (comma separated)
                      </label>
                      <input
                        type="text"
                        value={editForm.table_data?.headers?.join(', ') || ''}
                        onChange={(e) => {
                          const headers = e.target.value.split(',').map(h => h.trim()).filter(h => h);
                          setEditForm({
                            ...editForm,
                            table_data: {
                              ...editForm.table_data,
                              headers,
                              rows: editForm.table_data?.rows || []
                            }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Header 1, Header 2, Header 3..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Table Rows
                      </label>
                      <div className="space-y-2">
                        {editForm.table_data?.rows?.map((row, rowIndex) => (
                          <div key={rowIndex} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.join(', ')}
                              onChange={(e) => {
                                const newRowData = e.target.value.split(',').map(cell => cell.trim());
                                const newRows = [...(editForm.table_data?.rows || [])];
                                newRows[rowIndex] = newRowData;
                                setEditForm({
                                  ...editForm,
                                  table_data: {
                                    ...editForm.table_data,
                                    headers: editForm.table_data?.headers || [],
                                    rows: newRows
                                  }
                                });
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder={`Row ${rowIndex + 1} data (comma separated)...`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = editForm.table_data?.rows?.filter((_, i) => i !== rowIndex) || [];
                                setEditForm({
                                  ...editForm,
                                  table_data: {
                                    ...editForm.table_data,
                                    headers: editForm.table_data?.headers || [],
                                    rows: newRows
                                  }
                                });
                              }}
                              className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                            >
                              ✕
                            </button>
                          </div>
                        )) || []}
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...(editForm.table_data?.rows || []), ['']];
                            setEditForm({
                              ...editForm,
                              table_data: {
                                ...editForm.table_data,
                                headers: editForm.table_data?.headers || [],
                                rows: newRows
                              }
                            });
                          }}
                          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-300">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Preview
                      </label>
                      {editForm.table_data && renderTable(editForm.table_data, true)}
                    </div>
                  </div>
                </div>
              )}
              
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
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Type
                  </label>
                  <select
                    value={localQuestion.question_type}
                    onChange={(e) => {
                      const newType = e.target.value as 'multiple_choice' | 'grid_in';
                      setLocalQuestion({...localQuestion, question_type: newType});
                      setEditForm({...editForm, question_type: newType});
                      
                      // Reset options if switching to grid_in
                      if (newType === 'grid_in') {
                        setEditForm({...editForm, options: {}, question_type: newType});
                      } else if (newType === 'multiple_choice' && !editForm.options) {
                        // Set default options if switching to multiple choice
                        setEditForm({
                          ...editForm, 
                          options: {
                            'A': '{"text": "Option A"}',
                            'B': '{"text": "Option B"}',
                            'C': '{"text": "Option C"}',
                            'D': '{"text": "Option D"}'
                          },
                          question_type: newType
                        });
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="grid_in">Grid In (Open Answer)</option>
                  </select>
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
                    placeholder={localQuestion.question_type === 'multiple_choice' ? "Correct answer (e.g., A, B, C, D)" : "Correct numeric/text answer"}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation (Optional)
                </label>
                <RichTextEditor
                  value={editForm.explanation}
                  onChange={(value) => setEditForm({...editForm, explanation: value})}
                  placeholder="Explain the correct answer..."
                  rows={5}
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
                onError={(e) => {
                  console.error('Question image failed to load:', localQuestion.question_image_url);
                  e.currentTarget.style.display = 'none';
                }}
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
          <div className="mt-6 space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong> {userAnswer}
              </p>
            </div>
            
            {/* Admin Preview: Check Answer Button */}
            {isAdminPreview && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowAnswerCheck(!showAnswerCheck)}
                  className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                >
                  {showAnswerCheck ? 'Hide Answer' : 'Check Answer'}
                </button>
                
                {showAnswerCheck && (
                  <div className={`p-3 border rounded-lg ${
                    userAnswer?.trim().toUpperCase() === String(localQuestion.correct_answer).trim().toUpperCase()
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    {userAnswer?.trim().toUpperCase() === String(localQuestion.correct_answer).trim().toUpperCase() ? (
                      <p className="text-sm text-green-800 font-medium">
                        ✅ 정답입니다!
                      </p>
                    ) : (
                      <p className="text-sm text-red-800">
                        <span className="font-medium">❌ 오답입니다.</span>
                        <br />
                        <strong>정답:</strong> {localQuestion.correct_answer}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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

