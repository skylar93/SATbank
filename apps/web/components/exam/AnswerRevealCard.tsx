'use client'

import { useState } from 'react'
import { Question } from '../../lib/exam-service'
import { renderHtmlContent } from './question-display'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { isEmptyHtml } from '../../lib/content-converter'
import { Button } from '../ui/button'

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
          ([key, value]) => key === question.correct_answer
        )

      if (correctOption) {
        let optionText = correctOption[1]

        // Handle JSON string options
        if (typeof optionText === 'string' && optionText.startsWith('{')) {
          try {
            const parsed = JSON.parse(optionText)
            optionText = parsed.text || optionText
          } catch {
            // Keep original if parsing fails
          }
        }

        return `${question.correct_answer}. ${optionText}`
      }
      return question.correct_answer
    }
    return question.correct_answer
  }

  const getUserAnswerDisplay = () => {
    if (question.question_type === 'multiple_choice') {
      const userOption =
        question.options &&
        Object.entries(question.options).find(
          ([key, value]) => key === userAnswer
        )
      return userOption ? `${userAnswer}. ${userOption[1]}` : userAnswer
    }
    return userAnswer
  }

  return (
    <div className="bg-white/90 backdrop-blur-md border border-gray-100/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.07)] mt-4 overflow-hidden">
      {/* Result Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 ${
        isCorrect ? 'bg-gray-50/80' : 'bg-gray-50/80'
      }`}>
        {isCorrect ? (
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            {isCorrect ? 'Correct' : 'Incorrect'}
          </h3>
          <p className="text-xs text-gray-400">
            {isCorrect ? 'Well done!' : "Don't worry, keep practicing!"}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Answer Comparison */}
        {!isCorrect && showCorrectAnswer && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Correct Answer</p>
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/80 text-sm text-gray-800">
              {(() => {
                const correctAnswer = getCorrectAnswerDisplay() || 'Answer not available'
                return <span>{correctAnswer}</span>
              })()}
            </div>
          </div>
        )}

        {/* Explanation */}
        {showExplanation &&
          question.explanation &&
          (isCorrect || showCorrectAnswer) && (
            <div>
              <div className="flex items-center justify-between mb-2">
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
              <div className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl">
                <div className="text-sm text-gray-700">
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
                    } else {
                      return <span className="text-gray-700">{explanationContent}</span>
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          {!isCorrect && onTryAgain && (
            <button
              onClick={onTryAgain}
              className="px-5 py-2 text-sm font-semibold text-gray-800 rounded-full border-2 border-gray-800 hover:bg-gray-800 hover:text-white transition-all duration-200"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onContinue}
            className="px-5 py-2 text-sm font-semibold text-white rounded-full bg-gray-900 hover:bg-gray-700 transition-all duration-200 flex items-center gap-1.5"
          >
            {isCorrect ? 'Continue' : 'Skip'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
