'use client'

import { useState } from 'react'
import { Question } from '../../lib/exam-service'
import { renderTextWithFormattingAndMath } from './question-display'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'
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
  showCorrectAnswer = true
}: AnswerRevealCardProps) {
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(false)

  const getCorrectAnswerDisplay = () => {
    if (question.question_type === 'multiple_choice') {
      const correctOption = question.options && Object.entries(question.options).find(([key, value]) => key === question.correct_answer)
      return correctOption ? `${question.correct_answer}. ${correctOption[1]}` : question.correct_answer
    }
    return question.correct_answer
  }

  const getUserAnswerDisplay = () => {
    if (question.question_type === 'multiple_choice') {
      const userOption = question.options && Object.entries(question.options).find(([key, value]) => key === userAnswer)
      return userOption ? `${userAnswer}. ${userOption[1]}` : userAnswer
    }
    return userAnswer
  }

  return (
    <div className="bg-white rounded-lg border shadow-lg p-6 mt-6">
      {/* Result Header */}
      <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
        isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        {isCorrect ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        )}
        <div>
          <h3 className={`text-lg font-semibold ${
            isCorrect ? 'text-green-800' : 'text-red-800'
          }`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </h3>
          <p className={`text-sm ${
            isCorrect ? 'text-green-600' : 'text-red-600'
          }`}>
            {isCorrect 
              ? 'Well done!' 
              : showCorrectAnswer 
                ? 'Don\'t worry, keep practicing!' 
                : 'Try a different answer!'}
          </p>
        </div>
      </div>

      {/* Answer Comparison */}
      <div className="space-y-4 mb-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Answer:</h4>
          <div className={`p-3 rounded-lg border ${
            isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="text-sm">
              {renderTextWithFormattingAndMath(getUserAnswerDisplay() || 'No answer provided')}
            </div>
          </div>
        </div>

        {!isCorrect && showCorrectAnswer && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</h4>
            <div className="p-3 rounded-lg border bg-green-50 border-green-200">
              <div className="text-sm">
                {renderTextWithFormattingAndMath(getCorrectAnswerDisplay() || 'Answer not available')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explanation */}
      {showExplanation && question.explanation && (isCorrect || showCorrectAnswer) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Explanation:</h4>
            {question.explanation.length > 300 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetailedExplanation(!showDetailedExplanation)}
              >
                {showDetailedExplanation ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-gray-700">
              {renderTextWithFormattingAndMath(
                showDetailedExplanation || question.explanation.length <= 300
                  ? question.explanation
                  : question.explanation.substring(0, 300) + '...'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {/* Try Again button - show for incorrect answers when onTryAgain is provided */}
        {!isCorrect && onTryAgain && (
          <Button
            onClick={onTryAgain}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 flex items-center gap-2 font-semibold"
          >
            Try Again
          </Button>
        )}
        <Button
          onClick={onContinue}
          className={`px-6 py-2 flex items-center gap-2 ${
            isCorrect 
              ? 'bg-green-600 hover:bg-green-700 text-white font-semibold' 
              : 'bg-gray-500 hover:bg-gray-600 text-white'
          }`}
        >
          {isCorrect ? 'Great! Continue' : 'Skip & Continue'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}