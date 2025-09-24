'use client'

import { useState, useEffect } from 'react'
import { Question } from '../../lib/exam-service'
import { TableData, OptionData } from '../../lib/types'
import { InlineMath, BlockMath } from 'react-katex'
import { supabase } from '../../lib/supabase'
import { WysiwygEditor } from '../wysiwyg-editor'
import { RichTextEditor } from '../rich-text-editor'
import {
  markdownToHtml,
  htmlToMarkdown,
  isEmptyHtml,
  isEmptyMarkdown,
} from '../../lib/content-converter'
import { updateQuestionWithDualFormat } from '../../lib/actions/question-actions'
import { ImageUpload } from '../image-upload'
import { HelpCircle } from 'lucide-react'
import { TableEditor } from '../admin/TableEditor'
import { parseTableFromMarkdown, buildTableMarkdown } from '../../lib/utils'
import { HighlightedTextRendererMemo } from './HighlightedTextRenderer'
import FloatingHighlightButton from './FloatingHighlightButton'
import { AnswerRevealCard } from './AnswerRevealCard'
import { ContentRenderer } from '../content-renderer'
import { QuestionTimer } from './question-timer'
import { parseCorrectAnswers, formatCorrectAnswersDisplay } from '../../lib/grid-in-validator'

// HTML rendering function for content that is already in HTML format
export const renderHtmlContent = (htmlContent: string) => {
  if (!htmlContent || typeof htmlContent !== 'string') return htmlContent

  // Check if content contains LaTeX math expressions (data-math attributes)
  if (htmlContent.includes('data-math')) {
    // Use ContentRenderer to handle math rendering
    return <ContentRenderer htmlContent={htmlContent} />
  }

  // Check if content contains $...$ patterns and convert them for KaTeX rendering
  if (htmlContent.includes('$')) {
    const processedHtml = htmlContent.replace(/\$([^$]+)\$/g, (match, latex) => {
      return `<span data-math="${latex}" data-inline="true"></span>`
    }).replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
      return `<span data-math="${latex}" data-inline="false"></span>`
    })

    // If we processed any math, use ContentRenderer
    if (processedHtml !== htmlContent) {
      return <ContentRenderer htmlContent={processedHtml} />
    }
  }

  // Auto-detect simple mathematical expressions and wrap them in $ delimiters
  let processedContent = htmlContent

  // Pattern for simple equations like s=10+4t, x+y=5, etc.
  const simpleEquationPattern = /\b([a-zA-Z]\s*[=+\-*/]\s*[\da-zA-Z+\-*/\s]+(?:[=+\-*/]\s*[\da-zA-Z+\-*/\s]*)*)\b/g

  processedContent = processedContent.replace(simpleEquationPattern, (match) => {
    // Only process if it looks like an equation (contains = or is a simple expression)
    if (match.includes('=') || /^[a-zA-Z]\s*[+\-*/]\s*\d/.test(match)) {
      return `<span data-math="${match.trim()}" data-inline="true"></span>`
    }
    return match
  })

  // If we processed any math expressions, use ContentRenderer
  if (processedContent !== htmlContent) {
    return <ContentRenderer htmlContent={processedContent} />
  }

  return (
    <div
      className="max-w-none [&_*]:!font-[inherit] text-gray-900 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{ fontFamily: 'inherit' }}
    />
  )
}

// Legacy text rendering function for markdown (kept for backward compatibility)
export const renderTextWithFormattingAndMath = (text: string) => {
  if (!text || typeof text !== 'string') return text

  // Auto-detect simple mathematical expressions and wrap them in $ delimiters
  let processedText = text

  // Pattern for simple equations like s=10+4t, x+y=5, etc.
  const simpleEquationPattern = /\b([a-zA-Z]\s*[=+\-*/]\s*[\da-zA-Z+\-*/\s]+(?:[=+\-*/]\s*[\da-zA-Z+\-*/\s]*)*)\b/g

  processedText = processedText.replace(simpleEquationPattern, (match) => {
    // Only process if it looks like an equation and isn't already wrapped in $
    if ((match.includes('=') || /^[a-zA-Z]\s*[+\-*/]\s*\d/.test(match)) &&
        !text.includes(`$${match}$`)) {
      return `$${match.trim()}$`
    }
    return match
  })

  // First, handle escaped dollar signs by replacing \$ with a unique placeholder
  const escapedDollarPlaceholder = '§§§DOLLAR§§§'
  processedText = processedText.replace(/\\\$/g, escapedDollarPlaceholder)

  // Function to restore escaped dollars in final output
  const restoreEscapedDollars = (content: string): string => {
    if (typeof content === 'string') {
      return content.replace(
        new RegExp(escapedDollarPlaceholder.replace(/\§/g, '\\§'), 'g'),
        '$'
      )
    }
    return content
  }

  const parts = []
  let lastIndex = 0

  // Combined regex for tables, positioned images, math expressions, formatting, line breaks, dashes, long blanks, center alignment, and images
  // CRITICAL: _{5,} MUST be first among underscore patterns to get priority
  const combinedRegex =
    /({{table}}[\s\S]*?{{\/table}}|{{img-(left|center|right)}}!\[(.*?)\]\((.*?)\){{\/img-(left|center|right)}}|_{5,}|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|::(.*?)::|!\[(.*?)\]\((.*?)\)|\*\*(.*?)\*\*|\*(.*?)\*|__([^_]*?)__|_([^_]*?)_|\^\^(.*?)\^\^|\~\~(.*?)\~\~|---|--|\\n|\n)/g

  let match: RegExpExecArray | null

  while ((match = combinedRegex.exec(processedText)) !== null) {
    // Add text before current match
    if (match.index > lastIndex) {
      const textBefore = processedText.substring(lastIndex, match.index)
      if (textBefore) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {restoreEscapedDollars(textBefore)}
          </span>
        )
      }
    }

    const matchedContent = match[1]

    // Handle tables
    if (matchedContent.startsWith('{{table}}')) {
      const tableContent = matchedContent
        .replace(/{{table}}|{{\/table}}/g, '')
        .trim()
      const lines = tableContent.split('\n').filter((line) => line.trim())

      if (lines.length >= 3) {
        const headers = lines[0].split('|').map((h) => h.trim())
        const rows = lines
          .slice(2)
          .map((line) => line.split('|').map((cell) => cell.trim()))

        parts.push(
          <div
            key={`table-${match.index}`}
            className="my-4 overflow-x-auto max-w-full"
          >
            <table className="w-full border-collapse border border-gray-300 bg-white">
              <thead>
                <tr className="bg-gray-50">
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900 break-words"
                    >
                      {renderTextWithFormattingAndMath(
                        restoreEscapedDollars(header)
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="border border-gray-300 px-4 py-2 text-gray-900 break-words"
                      >
                        {renderTextWithFormattingAndMath(
                          restoreEscapedDollars(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    }
    // Handle positioned images
    else if (match[2] && match[3] && match[4]) {
      const position = match[2]
      const alt = match[3]
      const url = match[4]

      const alignmentClass =
        position === 'left'
          ? 'text-left'
          : position === 'right'
            ? 'text-right'
            : 'text-center'

      parts.push(
        <div
          key={`positioned-image-${match.index}`}
          className={`my-4 ${alignmentClass}`}
        >
          <img
            src={url}
            alt={restoreEscapedDollars(alt)}
            className="max-w-full h-auto border border-gray-200 rounded inline-block"
            onError={(e) => {
              console.error('Image failed to load:', url)
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    }
    // Handle long blanks (5 or more underscores) - MUST BE FIRST
    else if (matchedContent.match(/_{5,}/)) {
      const blankLength = matchedContent.length
      parts.push(
        <span
          key={`blank-${match.index}`}
          style={{
            display: 'inline-block',
            width: `${Math.max(blankLength * 0.8, 3)}em`,
            minWidth: '3em',
            borderBottom: '1px solid #374151',
            height: '1.2em',
            marginBottom: '1px',
          }}
        >
          &nbsp;
        </span>
      )
    }
    // Handle center alignment ::text::
    else if (match[6] !== undefined) {
      parts.push(
        <div key={`center-${match.index}`} className="text-center my-2">
          {renderTextWithFormattingAndMath(restoreEscapedDollars(match[6]))}
        </div>
      )
    }
    // Handle math expressions (but not if they contain escaped dollars)
    else if (
      matchedContent.startsWith('$') &&
      !matchedContent.includes(escapedDollarPlaceholder)
    ) {
      const isBlock = matchedContent.startsWith('$$')
      const cleanMath = matchedContent.replace(/^\$+|\$+$/g, '').trim()

      try {
        if (isBlock) {
          parts.push(
            <div key={`math-${match.index}`} className="my-4">
              <BlockMath math={cleanMath} />
            </div>
          )
        } else {
          parts.push(
            <InlineMath key={`math-${match.index}`} math={cleanMath} />
          )
        }
      } catch (error) {
        console.error('KaTeX render error:', error)
        parts.push(
          <span key={`fallback-${match.index}`} className="text-red-500">
            {matchedContent}
          </span>
        )
      }
    }
    // Handle markdown images ![alt](url)
    else if (match[7] !== undefined && match[8] !== undefined) {
      const imageUrl = match[8]
      const imageAlt = match[7]
      parts.push(
        <img
          key={`image-${match.index}`}
          src={imageUrl}
          alt={restoreEscapedDollars(imageAlt)}
          className="max-w-full h-auto my-2 border border-gray-200 rounded"
          onError={(e) => {
            console.error('Image failed to load:', imageUrl)
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    // Handle bold formatting **text**
    else if (match[9] !== undefined) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold">
          {restoreEscapedDollars(match[9])}
        </strong>
      )
    }
    // Handle italic formatting *text*
    else if (match[10] !== undefined) {
      parts.push(
        <em key={`italic-${match.index}`} className="italic">
          {restoreEscapedDollars(match[10])}
        </em>
      )
    }
    // Handle underline formatting __text__
    else if (match[11] !== undefined) {
      parts.push(
        <span key={`underline-${match.index}`} className="underline">
          {restoreEscapedDollars(match[11])}
        </span>
      )
    }
    // Handle italic formatting _text_
    else if (match[12] !== undefined) {
      parts.push(
        <em key={`italic2-${match.index}`} className="italic">
          {restoreEscapedDollars(match[12])}
        </em>
      )
    }
    // Handle superscript formatting ^^text^^
    else if (match[13] !== undefined) {
      parts.push(
        <sup key={`superscript-${match.index}`} className="text-sm">
          {restoreEscapedDollars(match[13])}
        </sup>
      )
    }
    // Handle subscript formatting ~~text~~
    else if (match[14] !== undefined) {
      parts.push(
        <sub key={`subscript-${match.index}`} className="text-sm">
          {restoreEscapedDollars(match[14])}
        </sub>
      )
    }
    // Handle dashes --- and --
    else if (matchedContent === '---' || matchedContent === '--') {
      parts.push(
        <span key={`dash-${match.index}`} className="inline">
          —
        </span>
      )
    }
    // Handle line breaks \n and literal \n
    else if (matchedContent === '\n' || matchedContent === '\\n') {
      parts.push(<br key={`br-${match.index}`} />)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < processedText.length) {
    const remainingText = processedText.substring(lastIndex)
    if (remainingText) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {restoreEscapedDollars(remainingText)}
        </span>
      )
    }
  }

  // If no formatting was found, return the original text with escaped dollars processed
  if (parts.length === 0) {
    return restoreEscapedDollars(processedText)
  }

  return <>{parts}</>
}

interface Highlight {
  start: number
  end: number
  text: string
}

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
  isCorrect?: boolean
  isSecondTryCorrect?: boolean
  moduleDisplayName?: string
  questionContentRef?: React.RefObject<HTMLDivElement>
  highlights?: Highlight[]
  onRemoveHighlight?: (highlight: Highlight) => void
  onAddHighlight?: (highlight: Highlight) => void
  showPerQuestionAnswers?: boolean
  onAnswerSubmit?: (questionId: string, answer: string) => Promise<boolean>
  onContinueAfterAnswer?: () => void
  isAnswerSubmitted?: boolean
  onCheckAnswer?: () => void
  onTryAgain?: () => void
  showCorrectAnswer?: boolean
  module?: Question['module_type']
  isPaused?: boolean
  examTitle?: string
  examId?: string
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
  onToggleMarkForReview,
  isCorrect,
  isSecondTryCorrect = false,
  moduleDisplayName,
  questionContentRef,
  highlights = [],
  onRemoveHighlight,
  onAddHighlight,
  showPerQuestionAnswers = false,
  onAnswerSubmit,
  onContinueAfterAnswer,
  isAnswerSubmitted = false,
  onCheckAnswer,
  onTryAgain,
  showCorrectAnswer = true,
  module,
  isPaused = false,
  examTitle,
  examId,
}: QuestionDisplayProps) {
  // Early return if question is not provided
  if (!question) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading question...</div>
      </div>
    )
  }

  const [isEditing, setIsEditing] = useState(false)
  const [localQuestion, setLocalQuestion] = useState(question)
  const [editForm, setEditForm] = useState({
    question_text: question.question_text,
    question_html: question.question_html || '',
    question_type: question.question_type,
    options: question.options || {},
    correct_answer: question.correct_answer,
    correct_answers: parseCorrectAnswers(question),
    explanation: question.explanation || '',
    table_data: question.table_data || null,
    content_format: question.content_format || 'markdown',
  })
  const [saving, setSaving] = useState(false)
  const [showFormattingHelp, setShowFormattingHelp] = useState(false)

  // Answer elimination state
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<string>>(new Set())

  // Handle answer elimination
  const toggleAnswerElimination = (answerKey: string) => {
    setEliminatedAnswers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(answerKey)) {
        newSet.delete(answerKey)
      } else {
        newSet.add(answerKey)
      }
      return newSet
    })
  }

  // Dual Mode state
  const [currentEditorMode, setCurrentEditorMode] = useState<
    'markdown' | 'html'
  >((question.content_format as 'markdown' | 'html') || 'markdown')

  // Get global editor mode from environment variable

  const getEditorMode = (): 'markdown' | 'dual' | 'html' => {
    return (
      (process.env.NEXT_PUBLIC_EDITOR_MODE as 'markdown' | 'dual' | 'html') ||
      'markdown'
    )
  }

  // Function to switch between editors (converts content)
  const switchEditor = (targetMode: 'markdown' | 'html') => {
    if (currentEditorMode === targetMode) return

    let convertedContent = ''
    if (targetMode === 'html' && currentEditorMode === 'markdown') {
      // Convert markdown to HTML
      convertedContent = markdownToHtml(editForm.question_text)
      setEditForm({
        ...editForm,
        question_html: convertedContent,
        content_format: 'html',
      })
    } else if (targetMode === 'markdown' && currentEditorMode === 'html') {
      // Convert HTML to markdown
      convertedContent = htmlToMarkdown(editForm.question_html)
      setEditForm({
        ...editForm,
        question_text: convertedContent,
        content_format: 'markdown',
      })
    }

    setCurrentEditorMode(targetMode)
  }

  // Update local question when prop changes
  useEffect(() => {
    setLocalQuestion(question)
    // Reset eliminated answers when question changes
    setEliminatedAnswers(new Set())
    // Reset the form directly with the new question's data.
    // The processing will be handled by handleEditClick when needed.
    setEditForm({
      question_text: question.question_text,
      question_html: question.question_html || '',
      question_type: question.question_type,
      options: question.options || {}, // Use the raw options here
      correct_answer: question.correct_answer,
      correct_answers: parseCorrectAnswers(question),
      explanation: question.explanation || '',
      table_data: question.table_data || null,
      content_format: question.content_format || 'markdown',
    })
    // If you are in edit mode and the question changes, exit edit mode to prevent confusion
    setIsEditing(false)
  }, [
    question.id,
    question.question_text,
    question.options,
    question.correct_answer,
    question.correct_answers,
    question.explanation,
  ])

  const handleSaveEdit = async () => {
    if (!onQuestionUpdate) return

    // Prevent multiple simultaneous saves
    if (saving) {
      return
    }

    setSaving(true)

    console.log('🔍 Question ID being saved:', question.id)
    console.log('🔍 Question object:', question)

    try {
      // Get the content from the currently active editor
      const currentContent =
        currentEditorMode === 'html'
          ? editForm.question_html
          : editForm.question_text

      // Direct Supabase update for debugging
      console.log('🔍 Updating directly with Supabase...')
      const updateData: any = {
        question_type: editForm.question_type,
        options: editForm.options,
        explanation: editForm.explanation,
        table_data: editForm.table_data,
        content_format: editForm.content_format,
      }

      if (editForm.question_type === 'grid_in') {
        const cleanAnswers = (editForm.correct_answers || [])
          .map((a: any) => String(a || '').trim())
          .filter((a: string) => a.length > 0)
        updateData.correct_answers =
          cleanAnswers.length > 0 ? cleanAnswers : ['']
        updateData.correct_answer = cleanAnswers[0] || ''
      } else {
        updateData.correct_answer = editForm.correct_answer
        updateData.correct_answers = null
      }

      if (editForm.content_format === 'html') {
        updateData.question_html = currentContent
        updateData.question_text = htmlToMarkdown(currentContent)
      } else {
        updateData.question_text = currentContent
        updateData.question_html = markdownToHtml(currentContent)
      }

      console.log('🔍 Update data:', updateData)
      const { data: supabaseResult, error } = await supabase
        .from('questions')
        .update(updateData)
        .eq('id', question.id)
        .select()

      console.log('🔍 Supabase result:', supabaseResult)
      console.log('🔍 Supabase error:', error)

      const result = {
        success: !error,
        data: supabaseResult?.[0] || null,
        error: error?.message || null,
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to save question')
      }

      // Update the local question object with the returned data
      const updatedQuestion = {
        ...localQuestion,
        ...result.data,
      }

      setLocalQuestion(updatedQuestion)

      // Call the callback to update the parent state (exam state)
      if (onQuestionUpdate) {
        onQuestionUpdate(updatedQuestion)
      }

      setIsEditing(false)
    } catch (error) {
      console.error('❌ Unexpected error saving question:', error)
      console.error(
        `❌ Failed to save question: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = () => {
    // Process options - keep table_data intact for the table editor to use
    const processedOptions = localQuestion.options
      ? Object.fromEntries(
          Object.entries(localQuestion.options).map(([key, value]) => {
            let optionData
            try {
              optionData = typeof value === 'string' ? JSON.parse(value) : value
              if (typeof optionData !== 'object' || optionData === null) {
                optionData = { text: String(value) }
              }
            } catch {
              optionData = { text: String(value) }
            }

            // Keep the original structure intact - don't convert to markdown yet
            // The table editor will handle the display and conversion
            return [key, JSON.stringify(optionData)]
          })
        )
      : {}

    // Set the fully prepared form state
    setEditForm({
      question_text: localQuestion.question_text,
      question_html: localQuestion.question_html || '',
      question_type: localQuestion.question_type,
      options: processedOptions,
      correct_answer: localQuestion.correct_answer,
      correct_answers: parseCorrectAnswers(localQuestion),
      explanation: localQuestion.explanation || '',
      table_data: localQuestion.table_data || null,
      content_format: localQuestion.content_format || (localQuestion.question_html ? 'html' : 'markdown'),
    })

    // THEN, enter edit mode
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditForm({
      question_text: localQuestion.question_text,
      question_html: localQuestion.question_html || '',
      question_type: localQuestion.question_type,
      options: localQuestion.options || {},
      correct_answer: localQuestion.correct_answer,
      correct_answers: parseCorrectAnswers(localQuestion),
      explanation: localQuestion.explanation || '',
      table_data: localQuestion.table_data || null,
      content_format: localQuestion.content_format || (localQuestion.question_html ? 'html' : 'markdown'),
    })
    setCurrentEditorMode(
      (localQuestion.content_format as 'markdown' | 'html') || (localQuestion.question_html ? 'html' : 'markdown')
    )
    setIsEditing(false)
  }

  const renderTable = (tableData: TableData, isCompact = false) => {
    if (!tableData || !tableData.headers || !tableData.rows) return null

    return (
      <div
        className={`${isCompact ? 'mt-2 mb-2' : 'mt-4 mb-4'} overflow-x-auto max-w-full`}
      >
        <table
          className={`w-full border-collapse border border-gray-300 bg-white ${isCompact ? 'text-sm' : ''}`}
        >
          <thead>
            <tr className="bg-gray-50">
              {tableData.headers.map((header: string, i: number) => (
                <th
                  key={i}
                  className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-left font-semibold text-gray-900 break-words`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: string[], i: number) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell: string, j: number) => (
                  <td
                    key={j}
                    className={`border border-gray-300 ${isCompact ? 'px-2 py-1' : 'px-4 py-2'} text-gray-900 break-words`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderAnswerChoiceContent = (value: string) => {
    // Handle null, undefined, or non-string values
    if (!value || typeof value !== 'string') {
      return <span className="text-gray-500 italic">No content</span>
    }

    // Only try to parse as JSON if it looks like JSON (starts with { or [)
    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value)

        // Check for direct table data in the parsed JSON
        if (
          parsed.table_data &&
          parsed.table_data.headers &&
          parsed.table_data.rows
        ) {
          return renderTable(parsed.table_data, true)
        }

        // Check if the parsed value itself is table data
        if (parsed.headers && parsed.rows) {
          return renderTable(parsed, true)
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
                    console.error(
                      'Answer choice image failed to load:',
                      parsed.imageUrl
                    )
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
            </div>
          )
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
            )
          }

          // For other objects, display as formatted text
          return (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
              <div className="font-medium">Object content detected:</div>
              <pre className="text-xs mt-1 whitespace-pre-wrap">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          )
        }

        // If parsed is a string or primitive, use it directly
        return renderTextWithFormattingAndMath(String(parsed))
      } catch (e) {
        // Not JSON, continue with regular text rendering
      }
    }

    // Check if it's a simple image URL
    if (
      typeof value === 'string' &&
      value.startsWith('http') &&
      (value.includes('.jpg') ||
        value.includes('.png') ||
        value.includes('.jpeg') ||
        value.includes('.gif') ||
        value.includes('.svg'))
    ) {
      return (
        <img
          src={value}
          alt="Answer choice image"
          className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
          onError={(e) => {
            console.error('Simple image URL failed to load:', value)
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }

    // Regular text rendering - use markdown renderer for proper formatting
    return renderTextWithFormattingAndMath(value)
  }

  const renderAnswerOptions = () => {
    if (
      localQuestion.question_type === 'multiple_choice' ||
      (isEditing && editForm.question_type === 'multiple_choice')
    ) {
      if (isEditing && editForm.question_type === 'multiple_choice') {
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Options
            </label>

            {/* Show message if no options exist yet */}
            {(!editForm.options ||
              Object.keys(editForm.options).length === 0) && (
              <div className="text-center p-4 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <p className="text-gray-600 text-sm mb-2">
                  No answer choices found for this question.
                </p>
                <p className="text-gray-500 text-xs">
                  Click "Add Answer Choice" below to create new options.
                </p>
              </div>
            )}

            {Object.entries(editForm.options || {}).map(([key, value]) => {
              let optionData
              try {
                optionData =
                  typeof value === 'string' ? JSON.parse(value) : value
                if (typeof optionData !== 'object') {
                  optionData = { text: String(value) }
                }
              } catch {
                optionData = { text: String(value) }
              }

              return (
                <div
                  key={key}
                  className="space-y-3 p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-8">
                        {key}.
                      </span>
                      <span className="text-sm text-gray-600">
                        Option {key}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newOptions = { ...(editForm.options || {}) }
                        delete newOptions[key]
                        setEditForm({
                          ...editForm,
                          options: newOptions,
                        })
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
                    <WysiwygEditor
                      content={optionData.text || ''}
                      onChange={(newValue) => {
                        const updatedOption = { ...optionData, text: newValue }
                        setEditForm({
                          ...editForm,
                          options: {
                            ...(editForm.options || {}),
                            [key]: JSON.stringify(updatedOption),
                          },
                        })
                      }}
                      placeholder={`Enter text for option ${key}...`}
                      rows={3}
                      compact={true}
                    />
                  </div>

                  {/* Table Editor for Answer Options */}
                  {(() => {
                    const optionText = optionData.text || ''
                    let tableDataInOption = parseTableFromMarkdown(optionText)

                    // Check if there's table_data in the original option that wasn't converted to markdown yet
                    if (
                      !tableDataInOption &&
                      optionData.table_data &&
                      optionData.table_data.headers &&
                      optionData.table_data.rows
                    ) {
                      tableDataInOption = optionData.table_data
                    }

                    // ALSO check if the table data is directly in optionData (not nested in table_data)
                    if (
                      !tableDataInOption &&
                      optionData.headers &&
                      optionData.rows
                    ) {
                      tableDataInOption = {
                        headers: optionData.headers,
                        rows: optionData.rows,
                      }
                    }

                    if (tableDataInOption) {
                      return (
                        <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-blue-50">
                          <h4 className="text-sm font-semibold text-blue-800 mb-2">
                            Table Editor (for Option {key})
                          </h4>
                          <TableEditor
                            tableData={tableDataInOption}
                            isCompact={true}
                            onTableDataChange={(newTableData) => {
                              const newTableMarkdown =
                                buildTableMarkdown(newTableData)
                              let updatedText = optionText

                              // If text already contains table markdown, replace it
                              if (parseTableFromMarkdown(optionText)) {
                                updatedText = optionText.replace(
                                  /{{table}}[\s\S]*?{{\/table}}/,
                                  newTableMarkdown
                                )
                              } else {
                                // If no table markdown exists, append it
                                updatedText =
                                  `${optionText}\n${newTableMarkdown}`.trim()
                              }

                              const updatedOption = {
                                ...optionData,
                                text: updatedText,
                                table_data: undefined, // Remove table_data as it's now in markdown format
                              }
                              setEditForm((prevForm) => ({
                                ...prevForm,
                                options: {
                                  ...(prevForm.options || {}),
                                  [key]: JSON.stringify(updatedOption),
                                },
                              }))
                            }}
                          />
                        </div>
                      )
                    }
                    return null
                  })()}

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
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add New Option Button */}
            <div className="text-center">
              <button
                onClick={() => {
                  const currentOptions = editForm.options || {}
                  const existingKeys = Object.keys(currentOptions)
                  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
                  const nextKey =
                    letters.find((letter) => !existingKeys.includes(letter)) ||
                    'A'

                  const newOptions = {
                    ...currentOptions,
                    [nextKey]: JSON.stringify({ text: '' }),
                  }

                  setEditForm({
                    ...editForm,
                    options: newOptions,
                  })
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
          {Object.entries(localQuestion.options || {}).map(([key, value]) => {
            // Normalize comparison - ensure both are strings and trim whitespace
            const normalizedCorrectAnswer = String(
              localQuestion.correct_answer || ''
            )
              .trim()
              .toUpperCase()
            const normalizedKey = String(key).trim().toUpperCase()
            const normalizedUserAnswer = String(userAnswer || '')
              .trim()
              .toUpperCase()

            const isCorrectAnswer = normalizedCorrectAnswer === normalizedKey
            const isUserAnswer = normalizedUserAnswer === normalizedKey
            const isEliminated = eliminatedAnswers.has(key)

            return (
              <label
                key={key}
                className={`
                flex items-start p-3 rounded-lg transition-all
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${isEliminated ? 'opacity-40' : ''}
                ${
                  // Priority 1: If this is the correct answer and student got it wrong, show green styling
                  showExplanation && isCorrectAnswer && !isUserAnswer
                    ? 'bg-green-100 border-2 border-green-500 ring-2 ring-green-300 shadow-md'
                    : // Priority 2: If this is the student's answer
                      isUserAnswer
                      ? showExplanation || disabled
                        ? isCorrect !== undefined
                          ? isCorrect
                            ? isSecondTryCorrect
                              ? 'bg-yellow-50 border-2 border-yellow-400 ring-2 ring-green-300 shadow-md'
                              : 'bg-green-50 border-2 border-green-500 ring-1 ring-green-200'
                            : 'bg-red-50 border-2 border-red-500 ring-1 ring-red-200'
                          : 'bg-blue-50 border-2 border-blue-500 ring-1 ring-blue-200'
                        : 'bg-blue-50 border-2 border-blue-500 ring-1 ring-blue-200'
                      : // Priority 3: Default styling
                        disabled
                        ? 'bg-gray-50 border-2 border-gray-200'
                        : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (!disabled && !showExplanation) {
                    toggleAnswerElimination(key)
                  }
                }}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  if (!disabled && !showExplanation) {
                    toggleAnswerElimination(key)
                  }
                }}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={key}
                  checked={isUserAnswer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                  disabled={
                    disabled || (showExplanation && !showPerQuestionAnswers)
                  }
                />
                <div className={`flex-1 ${isEliminated ? 'line-through' : ''}`}>
                  <div className="flex items-center mb-1">
                    <span className="font-semibold text-gray-700 mr-2">
                      {key}.
                    </span>
                    {isEliminated && (
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        Eliminated
                      </span>
                    )}
                  </div>
                  <div className="text-gray-900 leading-relaxed">
                    {(() => {
                      // Handle cases where value is already an object (not a string)
                      if (typeof value === 'object' && value !== null) {
                        const objValue = value as any // Type assertion to fix TypeScript error

                        // Check if it has table structure
                        if (objValue.headers && objValue.rows) {
                          return renderTable(objValue, true)
                        }

                        // Check if it has nested table_data
                        if (
                          objValue.table_data &&
                          objValue.table_data.headers &&
                          objValue.table_data.rows
                        ) {
                          return renderTable(objValue.table_data, true)
                        }

                        // Check for text/image content
                        if (objValue.text || objValue.imageUrl) {
                          return (
                            <div className="space-y-2">
                              {objValue.text && (
                                <div>
                                  {renderTextWithFormattingAndMath(
                                    objValue.text
                                  )}
                                </div>
                              )}
                              {objValue.imageUrl && (
                                <img
                                  src={objValue.imageUrl}
                                  alt="Answer choice image"
                                  className="max-w-full h-auto max-h-32 border border-gray-200 rounded"
                                  onError={(e) => {
                                    console.error(
                                      'Answer option object image failed to load:',
                                      objValue.imageUrl
                                    )
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                            </div>
                          )
                        }

                        // Fallback for unrecognized object structure
                        return (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
                            <div className="font-medium">
                              Debug: Object detected in option {key}
                            </div>
                            <pre className="text-xs mt-1 whitespace-pre-wrap">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          </div>
                        )
                      }

                      // Handle string values normally
                      return renderAnswerChoiceContent(String(value))
                    })()}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      )
    }

    if (
      localQuestion.question_type === 'grid_in' ||
      (isEditing && editForm.question_type === 'grid_in')
    ) {
      return (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              Enter your answer in the box below. For fractions, enter as "3/4".
              For decimals, use "0.75".
            </p>
            <input
              type="text"
              value={userAnswer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              className={`w-full p-3 text-lg font-mono border-2 rounded-lg ${
                disabled || (showExplanation && !showPerQuestionAnswers)
                  ? isCorrect !== undefined
                    ? isCorrect
                      ? isSecondTryCorrect
                        ? 'border-yellow-400 bg-yellow-50 cursor-not-allowed ring-2 ring-green-200'
                        : 'border-green-500 bg-green-50 cursor-not-allowed ring-1 ring-green-200'
                      : 'border-red-500 bg-red-50 cursor-not-allowed ring-1 ring-red-200'
                    : 'border-gray-300 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
              }`}
              placeholder="Enter your answer"
              disabled={
                disabled || (showExplanation && !showPerQuestionAnswers)
              }
            />
          </div>
          {showExplanation && isCorrect === false && (
            <div className="space-y-3">
              <div
                className="p-4 border rounded-lg bg-green-100 border-2 border-green-500 ring-1 ring-green-200"
              >
                <p
                  className="text-sm text-green-900 font-bold"
                >
                  <span
                    className="bg-green-200 px-2 py-1 rounded font-bold"
                  >
                    {localQuestion.question_type === 'grid_in'
                      ? formatCorrectAnswersDisplay(parseCorrectAnswers(localQuestion))
                      : localQuestion.correct_answer}
                  </span>
                </p>
              </div>
              {userAnswer && (
                <div
                  className={`p-3 border rounded-lg ${
                    isCorrect !== undefined
                      ? isCorrect
                        ? isSecondTryCorrect
                          ? 'bg-yellow-50 border-yellow-200 ring-1 ring-green-200'
                          : 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p
                    className={`text-sm ${
                      isCorrect !== undefined
                        ? isCorrect
                          ? isSecondTryCorrect
                            ? 'text-yellow-800'
                            : 'text-green-800'
                          : 'text-red-800'
                        : 'text-gray-800'
                    }`}
                  >
                    {userAnswer}
                  </p>
                </div>
              )}
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
      <div className="flex-1 lg:w-1/2 p-6 lg:pr-3 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-visible">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <h2
                className="text-lg font-semibold text-gray-900 truncate"
                title={
                  moduleDisplayName
                    ? `${moduleDisplayName}: ${questionNumber} of ${totalQuestions}`
                    : `Question ${questionNumber} of ${totalQuestions}`
                }
              >
                {moduleDisplayName
                  ? `${moduleDisplayName}: ${questionNumber} of ${totalQuestions}`
                  : `Question ${questionNumber} of ${totalQuestions}`}
              </h2>
              {!isAdminPreview && module && (
                <QuestionTimer
                  module={module}
                  questionId={question.id}
                  isPaused={isPaused || disabled}
                />
              )}
            </div>
            <div className="flex items-center space-x-2">
              {!isAdminPreview && !showExplanation && onToggleMarkForReview && (
                <button
                  onClick={onToggleMarkForReview}
                  disabled={disabled}
                  className={`
                    px-3 py-1 text-xs font-medium rounded transition-colors
                    ${
                      isMarkedForReview
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isMarkedForReview
                    ? '🏷️ Marked for Review'
                    : '🏷️ Mark for Review'}
                </button>
              )}
              {isAdminPreview && (
                <>
                  <span
                    className={`
                    px-2 py-1 rounded-full text-xs font-medium transition-all duration-200
                    ${localQuestion.difficulty_level === 'easy' ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700' : ''}
                    ${localQuestion.difficulty_level === 'medium' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700' : ''}
                    ${localQuestion.difficulty_level === 'hard' ? 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700' : ''}
                  `}
                  >
                    {localQuestion.difficulty_level}
                  </span>
                  <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded-full text-xs font-medium">
                    {localQuestion.module_type
                      .replace(/(\d)/, ' $1')
                      .toUpperCase()}
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
                        className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-xs rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50 font-medium"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-3 py-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-xs rounded-lg transition-all duration-200 shadow-sm disabled:opacity-50 font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEditClick}
                      className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs rounded-lg transition-all duration-200 shadow-sm font-medium"
                    >
                      Edit Question
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isAdminPreview &&
            localQuestion.topic_tags &&
            localQuestion.topic_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {localQuestion.topic_tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gradient-to-r from-purple-50 to-violet-50 text-purple-600 border border-purple-200 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
        </div>

        <div className="prose prose-gray max-w-none overflow-visible relative">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Question Text
                    </label>
                    {currentEditorMode === 'markdown' && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowFormattingHelp(!showFormattingHelp)
                        }
                        className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        title="Formatting Help"
                      >
                        <HelpCircle size={16} />
                      </button>
                    )}
                  </div>

                  {/* Editor Mode Controls */}
                  {(() => {
                    const editorMode = getEditorMode()
                    if (editorMode === 'dual') {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Editor:</span>
                          <button
                            type="button"
                            onClick={() => switchEditor('markdown')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              currentEditorMode === 'markdown'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            Markdown
                          </button>
                          <button
                            type="button"
                            onClick={() => switchEditor('html')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              currentEditorMode === 'html'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            WYSIWYG
                          </button>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                {showFormattingHelp && currentEditorMode === 'markdown' && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-gray-700">
                    <div className="font-semibold mb-2">Formatting Guide:</div>
                    <div className="space-y-1">
                      <div>
                        <strong>Text:</strong> **bold** *italic* __underline__
                        ^^superscript^^ ~~subscript~~ ::center::
                      </div>
                      <div>
                        <strong>Special:</strong> --- (em dash) _______ (long
                        blank) \n (line break)
                      </div>
                      <div>
                        <strong>Math:</strong> $x^2$ (inline) $$x^2$$ (block
                        equations)
                      </div>
                      <div>
                        <strong>Tables:</strong> Use Table button to insert
                        editable tables
                      </div>
                      <div>
                        <strong>Images:</strong> Use Image button for positioned
                        images (left/center/right)
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  const editorMode = getEditorMode()

                  // Determine which editor to show based on global and current mode
                  const shouldShowHtmlEditor =
                    editorMode === 'html' ||
                    (editorMode === 'dual' && currentEditorMode === 'html')

                  const shouldShowMarkdownEditor =
                    editorMode === 'markdown' ||
                    (editorMode === 'dual' && currentEditorMode === 'markdown')

                  if (shouldShowHtmlEditor) {
                    return (
                      <WysiwygEditor
                        content={editForm.question_html}
                        onChange={(value) =>
                          setEditForm({
                            ...editForm,
                            question_html: value,
                            content_format: 'html',
                          })
                        }
                        placeholder="Enter question text..."
                        rows={8}
                      />
                    )
                  }

                  if (shouldShowMarkdownEditor) {
                    return (
                      <RichTextEditor
                        value={editForm.question_text}
                        onChange={(value) =>
                          setEditForm({
                            ...editForm,
                            question_text: value,
                            content_format: 'markdown',
                          })
                        }
                        placeholder="Enter question text..."
                        rows={8}
                        showPreview={true}
                      />
                    )
                  }

                  // Fallback
                  return null
                })()}
              </div>

              {editForm.table_data && (
                <TableEditor
                  tableData={editForm.table_data}
                  onTableDataChange={(newTableData) => {
                    setEditForm({ ...editForm, table_data: newTableData })
                  }}
                />
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Type
                  </label>
                  <select
                    value={localQuestion.question_type}
                    onChange={(e) => {
                      const newType = e.target.value as
                        | 'multiple_choice'
                        | 'grid_in'
                      setLocalQuestion({
                        ...localQuestion,
                        question_type: newType,
                      })
                      setEditForm({ ...editForm, question_type: newType })

                      // Reset options and correct answers based on question type
                      if (newType === 'grid_in') {
                        // Get current answers, prioritizing parsed correct_answers
                        let currentAnswers: string[] = []

                        if (
                          editForm.correct_answers &&
                          Array.isArray(editForm.correct_answers) &&
                          editForm.correct_answers.length > 0
                        ) {
                          // Use existing correct_answers if it's a valid array
                          currentAnswers = editForm.correct_answers
                            .map((a) => String(a || '').trim())
                            .filter((a) => a.length > 0)
                        } else if (editForm.correct_answer) {
                          // Use correct_answer as fallback
                          currentAnswers = [
                            String(editForm.correct_answer).trim(),
                          ]
                        } else {
                          // Default empty answer
                          currentAnswers = ['']
                        }

                        setEditForm({
                          ...editForm,
                          options: {},
                          question_type: newType,
                          correct_answers: currentAnswers,
                        })
                      } else if (newType === 'multiple_choice') {
                        // Set default options if switching to multiple choice
                        const defaultOptions =
                          editForm.options &&
                          Object.keys(editForm.options).length > 0
                            ? editForm.options
                            : {
                                A: '{"text": "Option A"}',
                                B: '{"text": "Option B"}',
                                C: '{"text": "Option C"}',
                                D: '{"text": "Option D"}',
                              }

                        setEditForm({
                          ...editForm,
                          options: defaultOptions,
                          question_type: newType,
                          correct_answers: [],
                        })
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
                    {editForm.question_type === 'grid_in' ? 's' : ''}
                  </label>

                  {editForm.question_type === 'grid_in' ? (
                    <div className="space-y-3">
                      {/* Display current answers as individual text boxes */}
                      {(editForm.correct_answers &&
                      editForm.correct_answers.length > 0
                        ? editForm.correct_answers
                        : ['']
                      ).map((answer: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={String(answer || '')}
                            onChange={(e) => {
                              const newAnswers = [
                                ...(editForm.correct_answers || ['']),
                              ]
                              newAnswers[index] = e.target.value
                              setEditForm({
                                ...editForm,
                                correct_answers: newAnswers,
                              })
                            }}
                            className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder={`Correct answer ${index + 1} (e.g., 18, 3/4, 0.75)`}
                          />
                          {(editForm.correct_answers || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newAnswers =
                                  editForm.correct_answers?.filter(
                                    (_: string, i: number) => i !== index
                                  ) || []
                                setEditForm({
                                  ...editForm,
                                  correct_answers:
                                    newAnswers.length === 0 ? [''] : newAnswers,
                                })
                              }}
                              className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-md transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newAnswers = [
                            ...(editForm.correct_answers || ['']),
                            '',
                          ]
                          setEditForm({
                            ...editForm,
                            correct_answers: newAnswers,
                          })
                        }}
                        className="w-full px-4 py-2 text-orange-600 hover:text-orange-800 border border-orange-300 hover:border-orange-400 rounded-md transition-colors"
                      >
                        + Add Another Correct Answer
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editForm.correct_answer}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          correct_answer: e.target.value,
                        })
                      }
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Correct answer (e.g., A, B, C, D)"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation (Optional)
                </label>
                <WysiwygEditor
                  content={editForm.explanation}
                  onChange={(value) =>
                    setEditForm({ ...editForm, explanation: value })
                  }
                  placeholder="Explain the correct answer..."
                  rows={5}
                />
              </div>
            </div>
          ) : (
            <div
              ref={questionContentRef}
              className="text-gray-900 leading-relaxed relative overflow-visible min-h-[60px]"
            >
              <HighlightedTextRendererMemo
                text={(() => {
                  // Simple priority-based rendering: HTML first, then fallback to markdown
                  if (
                    localQuestion.question_html &&
                    !isEmptyHtml(localQuestion.question_html)
                  ) {
                    // HTML content exists and is not empty - render as HTML
                    return localQuestion.question_html
                  } else {
                    // No HTML or empty HTML - render markdown text
                    return localQuestion.question_text
                  }
                })()}
                highlights={highlights}
                onRemoveHighlight={onRemoveHighlight}
                isHtml={
                  !!(
                    localQuestion.question_html &&
                    !isEmptyHtml(localQuestion.question_html)
                  )
                }
              />
              {!isAdminPreview && questionContentRef && onAddHighlight && (
                <FloatingHighlightButton
                  containerRef={questionContentRef}
                  onHighlight={onAddHighlight}
                  examTitle={examTitle}
                  examId={examId}
                />
              )}
            </div>
          )}

          {!isEditing && localQuestion.question_image_url && (
            <div className="mt-4">
              <img
                src={localQuestion.question_image_url}
                alt="Question diagram or image"
                className="max-w-full h-auto border border-gray-200 rounded"
                onError={(e) => {
                  console.error(
                    'Question image failed to load:',
                    localQuestion.question_image_url
                  )
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          {!isEditing &&
            localQuestion.table_data &&
            renderTable(localQuestion.table_data)}
        </div>
      </div>

      {/* Answer Selection Area */}
      <div className="flex-1 lg:w-1/2 p-6 lg:pl-3">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {localQuestion.question_type === 'multiple_choice'
              ? 'Select your answer:'
              : 'Enter your answer:'}
          </h3>
          {localQuestion.question_type === 'multiple_choice' && !isAdminPreview && !showExplanation && (
            <p className="text-sm text-gray-600 mb-4">
              💡 Right-click or double-click on answer choices to eliminate them
            </p>
          )}

          {renderAnswerOptions()}

          {/* Check Answer Button for per-question mode */}
          {showPerQuestionAnswers &&
            !isAnswerSubmitted &&
            userAnswer &&
            userAnswer.trim() &&
            onCheckAnswer && (
              <div className="mt-4">
                <button
                  onClick={onCheckAnswer}
                  disabled={disabled}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold text-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                >
                  Check Answer
                </button>
              </div>
            )}

          {/* Answer Reveal Card for per-question mode */}
          {showPerQuestionAnswers &&
            isAnswerSubmitted &&
            isCorrect !== undefined && (
              <div className="mt-4">
                <AnswerRevealCard
                  question={question}
                  userAnswer={userAnswer || ''}
                  isCorrect={isCorrect}
                  onContinue={onContinueAfterAnswer || (() => {})}
                  onTryAgain={onTryAgain}
                  showExplanation={true}
                  showCorrectAnswer={showCorrectAnswer}
                />
              </div>
            )}
        </div>

        {/* Explanation (if showing results) */}
        {showExplanation && localQuestion.explanation && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Explanation:</h4>
            <div className="text-gray-700 leading-relaxed">
              {renderHtmlContent(localQuestion.explanation)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
