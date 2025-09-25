'use client'

import { ModuleType } from '../../lib/exam-service'

interface MarkedQuestion {
  question: any
  index: number
  isMarked: boolean
}

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
  markedQuestions: MarkedQuestion[]
  disabled?: boolean
  isAdminPreview?: boolean
  allModules?: {
    module: ModuleType
    questions: any[]
    currentQuestionIndex: number
  }[]
  currentModuleIndex?: number
  onGoToModule?: (moduleIndex: number, questionIndex: number) => void
  isCompact?: boolean
  correctQuestions?: Set<number>
  incorrectQuestions?: Set<number>
  secondTryCorrectQuestions?: Set<number>
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
  markedQuestions,
  disabled = false,
  isAdminPreview = false,
  allModules = [],
  currentModuleIndex = 0,
  onGoToModule,
  isCompact = false,
  correctQuestions = new Set(),
  incorrectQuestions = new Set(),
  secondTryCorrectQuestions = new Set(),
}: ExamNavigationProps) {
  const getModuleName = (module: ModuleType) => {
    const moduleNames = {
      english1: 'English Module 1',
      english2: 'English Module 2',
      math1: 'Math Module 1',
      math2: 'Math Module 2',
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

  // Admin Preview: Show all modules and questions
  if (isAdminPreview && allModules.length > 0) {
    if (isCompact) {
      // Compact top navigation for preview mode
      return (
        <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 px-4 py-2 shadow-lg">
          <div className="flex items-center justify-between">
            {/* Left: Module Overview - Horizontal layout */}
            <div className="flex items-center space-x-4">
              {allModules.map((module, moduleIndex) => {
                const isCurrentModule = moduleIndex === currentModuleIndex
                const moduleShortName = module.module
                  .replace(/^(\w+)(\d)$/, '$1$2')
                  .toUpperCase()
                return (
                  <div
                    key={moduleIndex}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm ${
                      isCurrentModule
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : 'bg-white/60 text-gray-600 hover:bg-white/80'
                    } transition-all duration-200`}
                  >
                    <span className="font-semibold">{moduleShortName}</span>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {module.questions.map((_, qIndex) => {
                        const isCurrent =
                          isCurrentModule &&
                          qIndex === module.currentQuestionIndex
                        const globalQuestionIndex =
                          allModules
                            .slice(0, moduleIndex)
                            .reduce((acc, m) => acc + m.questions.length, 0) +
                          qIndex +
                          1
                        const isAnswered =
                          answeredQuestions.has(globalQuestionIndex)
                        const isCorrect =
                          correctQuestions.has(globalQuestionIndex)
                        const isIncorrect =
                          incorrectQuestions.has(globalQuestionIndex)
                        const isSecondTryCorrect =
                          secondTryCorrectQuestions.has(globalQuestionIndex)

                        return (
                          <button
                            key={qIndex}
                            onClick={() =>
                              onGoToModule && onGoToModule(moduleIndex, qIndex)
                            }
                            disabled={disabled}
                            className={`w-5 h-5 text-xs rounded-md font-medium transition-all duration-200 ${
                              isCurrent
                                ? 'bg-purple-600 text-white shadow-sm'
                                : isSecondTryCorrect
                                  ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-green-300'
                                  : isCorrect
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : isIncorrect
                                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } disabled:opacity-50`}
                            title={`Question ${qIndex + 1}${isSecondTryCorrect ? ' - Second Try Correct' : isCorrect ? ' - Correct' : isIncorrect ? ' - Incorrect' : ''}`}
                          >
                            {qIndex + 1}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Empty space */}
            <div className="flex items-center"></div>
          </div>
        </div>
      )
    }

    // Full navigation for bottom position
    return (
      <div className="bg-white/80 backdrop-blur-sm border-t border-purple-100 px-6 py-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm">
              <span className="font-semibold text-purple-700">
                Admin Preview - All Modules
              </span>
            </div>
            <div className="text-xs text-purple-600/70">
              Navigate freely between all modules and questions
            </div>
          </div>

          {/* Show all modules */}
          <div className="space-y-4">
            {allModules.map((module, moduleIndex) => {
              const isCurrentModule = moduleIndex === currentModuleIndex
              return (
                <div
                  key={moduleIndex}
                  className={`border rounded-xl p-4 backdrop-blur-sm transition-all duration-200 ${
                    isCurrentModule
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-purple-100 bg-white/50 hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4
                      className={`text-sm font-semibold ${
                        isCurrentModule ? 'text-purple-800' : 'text-purple-700'
                      }`}
                    >
                      {getModuleName(module.module)}
                    </h4>
                    <span className="text-xs text-purple-600/70 px-2 py-1 bg-purple-100 rounded-full">
                      {module.questions.length} questions
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {module.questions.map((_, qIndex) => {
                      const questionNum = qIndex + 1
                      const isCurrent =
                        isCurrentModule &&
                        qIndex === module.currentQuestionIndex
                      const globalQuestionIndex =
                        allModules
                          .slice(0, moduleIndex)
                          .reduce((acc, m) => acc + m.questions.length, 0) +
                        qIndex +
                        1
                      const isAnswered =
                        answeredQuestions.has(globalQuestionIndex)
                      const isCorrect =
                        correctQuestions.has(globalQuestionIndex)
                      const isIncorrect =
                        incorrectQuestions.has(globalQuestionIndex)
                      const isSecondTryCorrect =
                        secondTryCorrectQuestions.has(globalQuestionIndex)
                      const isMarked = markedQuestions.some(
                        (mq) =>
                          mq.index === qIndex &&
                          mq.question?.module_type === module.module
                      )

                      return (
                        <button
                          key={qIndex}
                          onClick={() =>
                            onGoToModule && onGoToModule(moduleIndex, qIndex)
                          }
                          disabled={disabled}
                          className={`
                            w-9 h-9 text-sm font-semibold rounded-lg transition-all duration-200 relative shadow-sm
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${
                              isCurrent
                                ? 'bg-purple-600 text-white border-2 border-purple-500'
                                : isSecondTryCorrect
                                  ? 'bg-yellow-50 text-yellow-700 border border-green-300 hover:bg-yellow-100'
                                  : isCorrect
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                    : isIncorrect
                                      ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                                      : 'bg-white/80 text-purple-600 border border-purple-200 hover:bg-white hover:border-purple-300'
                            }
                          `}
                          title={`Question ${questionNum}${isSecondTryCorrect ? ' - Second Try Correct' : isCorrect ? ' - Correct' : isIncorrect ? ' - Incorrect' : ''}`}
                        >
                          {questionNum}
                          {isMarked && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                              <span className="text-xs text-white font-bold">
                                !
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Admin Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-purple-200">
          <div className="flex items-center space-x-4">
            <button
              onClick={onPrevious}
              disabled={disabled}
              className="px-4 py-2 text-purple-700 bg-white/60 border border-purple-200 rounded-lg hover:bg-white/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium backdrop-blur-sm"
            >
              ← Previous
            </button>
            <button
              onClick={onNext}
              disabled={disabled}
              className="px-4 py-2 text-purple-700 bg-white/60 border border-purple-200 rounded-lg hover:bg-white/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium backdrop-blur-sm"
            >
              Next →
            </button>
            <div className="text-sm text-purple-700 font-medium">
              Module {currentModuleIndex + 1} of {allModules.length} • Question{' '}
              {currentQuestion} of {totalQuestions}
            </div>
          </div>

          <div className="text-xs text-purple-700 font-semibold">
            🔍 Admin Preview Mode - Full Navigation Enabled
          </div>
        </div>
      </div>
    )
  }

  // Regular Student Navigation
  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      {/* Question Grid Navigation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{getModuleName(currentModule)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const questionNum = index + 1
            const isCorrect = correctQuestions.has(questionNum)
            const isIncorrect = incorrectQuestions.has(questionNum)
            const isSecondTryCorrect =
              secondTryCorrectQuestions.has(questionNum)
            const isAnswered =
              answeredQuestions.has(questionNum) || isCorrect || isIncorrect
            const isCurrent = questionNum === currentQuestion
            const isMarked = markedQuestions.some((mq) => mq.index === index)

            return (
              <button
                key={questionNum}
                onClick={() => onGoToQuestion(index)}
                disabled={disabled}
                className={`
                  w-8 h-8 text-sm font-medium rounded transition-all relative
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-2 border-blue-600'
                      : isSecondTryCorrect
                        ? 'bg-yellow-100 text-yellow-800 border border-green-300 hover:bg-yellow-200'
                        : isCorrect
                          ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                          : isIncorrect
                            ? 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                            : isAnswered
                              ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                  }
                `}
              >
                {questionNum}
                {isMarked && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">!</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Marked Questions Section */}
        {markedQuestions.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-yellow-800">
                📝 Marked for Review ({markedQuestions.length})
              </h4>
              <span className="text-xs text-yellow-600">
                Click to navigate to marked questions
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {markedQuestions.map((markedQuestion) => (
                <button
                  key={markedQuestion.index}
                  onClick={() => onGoToQuestion(markedQuestion.index)}
                  disabled={disabled}
                  className="px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Q{markedQuestion.index + 1}
                </button>
              ))}
            </div>
          </div>
        )}
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
                style={{
                  width: `${(currentQuestion / totalQuestions) * 100}%`,
                }}
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
    </div>
  )
}
