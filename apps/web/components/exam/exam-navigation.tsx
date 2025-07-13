'use client'

import { ModuleType } from '../../lib/exam-service'

interface ExamNavigationProps {
  currentQuestion: number
  totalQuestions: number
  currentModule: ModuleType
  hasAnswer: boolean
  isLastQuestion: boolean
  isLastModule: boolean
  onNext: () => void
  onPrevious: () => void
  onGoToQuestion: (questionIndex: number) => void
  onSubmitModule: () => void
  onSubmitExam: () => void
  answeredQuestions: Set<number>
  disabled?: boolean
}

export function ExamNavigation({
  currentQuestion,
  totalQuestions,
  currentModule,
  hasAnswer,
  isLastQuestion,
  isLastModule,
  onNext,
  onPrevious,
  onGoToQuestion,
  onSubmitModule,
  onSubmitExam,
  answeredQuestions,
  disabled = false
}: ExamNavigationProps) {

  const getModuleName = (module: ModuleType) => {
    const moduleNames = {
      english1: 'English Module 1',
      english2: 'English Module 2', 
      math1: 'Math Module 1',
      math2: 'Math Module 2'
    }
    return moduleNames[module]
  }

  const handleClick = () => {
    if (isLastQuestion && isLastModule) {
      onSubmitExam()
    } else if (isLastQuestion) {
      onSubmitModule()
    } else {
      onNext()
    }
  }

  const getButtonText = () => {
    if (isLastQuestion && isLastModule) {
      return 'Submit Exam'
    } else if (isLastQuestion) {
      return 'Complete Module'
    } else {
      return 'Next Question'
    }
  }

  const getButtonStyle = () => {
    if (isLastQuestion && isLastModule) {
      return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    } else if (isLastQuestion) {
      return 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    } else {
      return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }
  }

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      {/* Question Grid Navigation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{getModuleName(currentModule)}</span>
          </div>
          <div className="text-xs text-gray-500">
            Click any question number to navigate within this module
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const questionNum = index + 1
            const isAnswered = answeredQuestions.has(questionNum)
            const isCurrent = questionNum === currentQuestion
            
            return (
              <button
                key={questionNum}
                onClick={() => onGoToQuestion(index)}
                disabled={disabled}
                className={`
                  w-8 h-8 text-sm font-medium rounded transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isCurrent 
                    ? 'bg-blue-600 text-white border-2 border-blue-600' 
                    : isAnswered
                    ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                  }
                `}
              >
                {questionNum}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Left side - Navigation controls */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {/* Previous Button */}
            <button
              onClick={onPrevious}
              disabled={disabled || currentQuestion === 1}
              className="
                px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg
                hover:bg-gray-200 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              "
            >
              ← Previous
            </button>

            {/* Next Button */}
            <button
              onClick={onNext}
              disabled={disabled || isLastQuestion}
              className="
                px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg
                hover:bg-gray-200 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              "
            >
              Next →
            </button>
          </div>

          {/* Progress Info */}
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              Question {currentQuestion} of {totalQuestions}
            </div>
            
            {/* Progress Bar */}
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
              />
            </div>

            {/* Answer Status */}
            <div className="flex items-center space-x-1">
              {hasAnswer ? (
                <div className="flex items-center text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-1"></div>
                  <span className="text-sm font-medium">Answered</span>
                </div>
              ) : (
                <div className="flex items-center text-orange-500">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                  <span className="text-sm font-medium">Unanswered</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Module/Exam completion */}
        <div className="flex items-center space-x-4">
          {/* Warning for unanswered questions */}
          {!hasAnswer && (
            <div className="text-sm text-orange-600 font-medium">
              Continue without answering?
            </div>
          )}

          <button
            onClick={handleClick}
            disabled={disabled}
            className={`
              px-6 py-2 text-white font-medium rounded-lg transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${getButtonStyle()}
            `}
          >
            {getButtonText()}
          </button>
        </div>
      </div>

      {/* Updated SAT Notice */}
      <div className="mt-3 text-xs text-gray-500 italic">
        ⚠️ SAT Format: You can navigate between questions within this module, but cannot return to previous modules once completed.
      </div>
    </div>
  )
}