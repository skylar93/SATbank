'use client'

import { useState } from 'react'
import { Question } from '../../lib/exam-service'
import { renderHtmlContent } from './question-display'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { isEmptyHtml } from '../../lib/content-converter'

interface AnswerRevealCardProps {
  question: Question
  userAnswer: string
  isCorrect: boolean
  onContinue: () => void
  onTryAgain?: () => void
  showExplanation?: boolean
  showCorrectAnswer?: boolean
}

export function AnswerRevealCard({
  question,
  userAnswer,
  isCorrect,
  onContinue,
  onTryAgain,
  showExplanation = true,
  showCorrectAnswer = true,
}: AnswerRevealCardProps) {
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(false)

  const getCorrectAnswerDisplay = () => {
    if (question.question_type === 'multiple_choice') {
      const correctOption =
        question.options &&
        Object.entries(question.options).find(
          ([key]) => key === question.correct_answer
        )

      if (correctOption) {
        let optionText = correctOption[1]
        if (typeof optionText === 'string' && optionText.startsWith('{')) {
          try {
            const parsed = JSON.parse(optionText)
            optionText = parsed.text || optionText
          } catch {
            // keep original
          }
        }
        return `${question.correct_answer}. ${optionText}`
      }
      return question.correct_answer
    }
    return question.correct_answer
  }

  const hasBody =
    (!isCorrect && showCorrectAnswer) ||
    (showExplanation && question.explanation && (isCorrect || showCorrectAnswer))

  return (
    <div className="bg-white/90 backdrop-blur-md border border-gray-100/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.07)] mt-4 overflow-hidden">
      {/* Single-line result header */}
      <div className={`flex items-center justify-between px-4 py-3 ${hasBody ? 'border-b border-gray-100' : ''} bg-gray-50/80`}>
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-700">
            {isCorrect ? 'Correct' : 'Incorrect'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isCorrect && onTryAgain && (
            <button
              onClick={onTryAgain}
              className="px-4 py-1.5 text-xs font-semibold text-gray-800 rounded-full border-2 border-gray-800 hover:bg-gray-800 hover:text-white transition-all duration-200"
            >
              Try Again
            </button>
          )}
          {isCorrect && (
            <button
              onClick={onContinue}
              className="px-4 py-1.5 text-xs font-semibold text-white rounded-full bg-gray-900 hover:bg-gray-700 transition-all duration-200 flex items-center gap-1"
            >
              Continue
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Body: correct answer + explanation (only if needed) */}
      {hasBody && (
        <div className="px-4 py-3 space-y-3">
          {!isCorrect && showCorrectAnswer && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Correct Answer</p>
              <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/80 text-sm text-gray-800">
                {getCorrectAnswerDisplay() || 'Answer not available'}
              </div>
            </div>
          )}

          {showExplanation &&
            question.explanation &&
            (isCorrect || showCorrectAnswer) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Explanation</p>
                  {question.explanation.length > 300 && (
                    <button
                      onClick={() => setShowDetailedExplanation(!showDetailedExplanation)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {showDetailedExplanation ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>
                <div className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl text-sm text-gray-700">
                  {(() => {
                    const explanationContent =
                      showDetailedExplanation || question.explanation.length <= 300
                        ? question.explanation
                        : question.explanation.substring(0, 300) + '...'

                    if (question.explanation_html && !isEmptyHtml(question.explanation_html)) {
                      const htmlContent =
                        showDetailedExplanation || question.explanation_html.length <= 300
                          ? question.explanation_html
                          : question.explanation_html.substring(0, 300) + '...'
                      return renderHtmlContent(htmlContent)
                    }
                    return <span>{explanationContent}</span>
                  })()}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
