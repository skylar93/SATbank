'use client'

import { Question } from '../../lib/exam-service'

interface QuestionDisplayProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  userAnswer?: string
  onAnswerChange: (answer: string) => void
  showExplanation?: boolean
}

export function QuestionDisplay({
  question,
  questionNumber,
  totalQuestions,
  userAnswer,
  onAnswerChange,
  showExplanation = false
}: QuestionDisplayProps) {
  
  const renderAnswerOptions = () => {
    if (question.question_type === 'multiple_choice' && question.options) {
      return (
        <div className="space-y-3">
          {Object.entries(question.options).map(([key, value]) => (
            <label
              key={key}
              className={`
                flex items-start p-3 rounded-lg cursor-pointer transition-all
                ${userAnswer === key 
                  ? 'bg-blue-50 border-2 border-blue-500 ring-1 ring-blue-200' 
                  : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${showExplanation && question.correct_answer === key
                  ? 'bg-green-50 border-green-500'
                  : ''
                }
                ${showExplanation && userAnswer === key && question.correct_answer !== key
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
                disabled={showExplanation}
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="font-semibold text-gray-700 mr-2">{key}.</span>
                  {showExplanation && question.correct_answer === key && (
                    <span className="text-green-600 text-sm font-medium">✓ Correct</span>
                  )}
                  {showExplanation && userAnswer === key && question.correct_answer !== key && (
                    <span className="text-red-600 text-sm font-medium">✗ Incorrect</span>
                  )}
                </div>
                <div className="text-gray-900 leading-relaxed">{value}</div>
              </div>
            </label>
          ))}
        </div>
      )
    }

    if (question.question_type === 'grid_in') {
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
              className="w-full p-3 text-lg font-mono border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              placeholder="Enter your answer"
              disabled={showExplanation}
            />
          </div>
          {showExplanation && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Correct Answer:</strong> {question.correct_answer}
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
              <span className={`
                px-2 py-1 rounded text-xs font-medium
                ${question.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' : ''}
                ${question.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${question.difficulty_level === 'hard' ? 'bg-red-100 text-red-800' : ''}
              `}>
                {question.difficulty_level}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {question.module_type.replace(/(\d)/, ' $1').toUpperCase()}
              </span>
            </div>
          </div>
          
          {question.topic_tags && question.topic_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {question.topic_tags.map((tag, index) => (
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
          <div 
            className="text-gray-900 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: question.question_text }}
          />
          
          {question.question_image_url && (
            <div className="mt-4">
              <img
                src={question.question_image_url}
                alt="Question diagram or image"
                className="max-w-full h-auto border border-gray-200 rounded"
              />
            </div>
          )}
        </div>
      </div>

      {/* Answer Selection Area */}
      <div className="flex-1 lg:w-1/2 p-6 lg:pl-3">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {question.question_type === 'multiple_choice' ? 'Select your answer:' : 'Enter your answer:'}
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
        {showExplanation && question.explanation && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Explanation:</h4>
            <p className="text-gray-700 leading-relaxed">{question.explanation}</p>
          </div>
        )}
      </div>
    </div>
  )
}