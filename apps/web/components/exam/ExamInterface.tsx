'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ExamTimer } from './exam-timer'
import { QuestionDisplay } from './question-display'
import { ExamNavigation } from './exam-navigation'
import { ReferenceSheetModal } from './ReferenceSheetModal'
import { TimeExpiredOverlay } from './TimeExpiredOverlay'
import { HighlightToolbar } from './HighlightToolbar'
import { ModuleType } from '../../lib/exam-service'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { toast } from 'sonner'

interface ExamInterfaceProps {
  exam: {
    id: string
    title: string
  }
  currentModule: {
    module: ModuleType
    questions: any[]
    currentQuestionIndex: number
    timeRemaining: number
    answers: any
  }
  currentQuestion: any
  currentAnswer: string
  status: string
  modules: any[]
  currentModuleIndex: number
  timeExpiredRef: React.RefObject<boolean>
  questionContentRef: React.RefObject<HTMLDivElement>
  highlightsByQuestion: any
  answerCheckMode: 'exam_end' | 'per_question'
  showAnswerReveal: boolean
  answerRevealData: any
  shouldShowCorrectAnswer: boolean
  onAnswerChange: (answer: string) => void
  onNext: () => void
  onPrevious: () => void
  onGoToQuestion: (index: number) => void
  onSubmitModule: () => void
  onSubmitExam: () => void
  onTimeExpired: () => void
  onTimeUpdate: (timeRemaining: number) => void
  onExitAttempt: () => void
  onCheckAnswer: () => void
  onAnswerRevealContinue: () => void
  onTryAgain: () => void
  getCurrentAnswer: () => any
  isMarkedForReview: () => boolean
  toggleMarkForReview: () => void
  getMarkedQuestions: () => Array<{
    question: any
    index: number
    isMarked: boolean
  }>
  addHighlight: (questionId: string, highlight: any) => void
  removeHighlight: (questionId: string, highlight: any) => void
  getAnsweredQuestions: () => Set<number>
}

export function ExamInterface({
  exam,
  currentModule,
  currentQuestion,
  currentAnswer,
  status,
  modules,
  currentModuleIndex,
  timeExpiredRef,
  questionContentRef,
  highlightsByQuestion,
  answerCheckMode,
  showAnswerReveal,
  answerRevealData,
  shouldShowCorrectAnswer,
  onAnswerChange,
  onNext,
  onPrevious,
  onGoToQuestion,
  onSubmitModule,
  onSubmitExam,
  onTimeExpired,
  onTimeUpdate,
  onExitAttempt,
  onCheckAnswer,
  onAnswerRevealContinue,
  onTryAgain,
  getCurrentAnswer,
  isMarkedForReview,
  toggleMarkForReview,
  getMarkedQuestions,
  addHighlight,
  removeHighlight,
  getAnsweredQuestions,
}: ExamInterfaceProps) {
// Highlight mode state
const [isHighlightMode, setIsHighlightMode] = useState(false)
const [selectedVocabText, setSelectedVocabText] = useState('')
const [isAddingVocab, setIsAddingVocab] = useState(false)
const selectionChangeRaf = useRef<number | null>(null)

  // Reset highlight mode when question changes
  useEffect(() => {
    setIsHighlightMode(false)
  }, [currentQuestion.id])

  const isLastQuestion =
    currentModule.currentQuestionIndex === currentModule.questions.length - 1
  const isLastModule = currentModuleIndex === modules.length - 1

  // Toggle highlight mode function
  const toggleHighlightMode = () => {
    setIsHighlightMode(!isHighlightMode)
    // Clear selection when toggling mode
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges()
    }
  }

  // Clear all highlights for current question
  const clearAllHighlights = () => {
    const highlights = highlightsByQuestion[currentQuestion.id] || []
    highlights.forEach((highlight: any) => {
      removeHighlight(currentQuestion.id, highlight)
    })
  }

  useEffect(() => {
    const handleSelectionChange = () => {
      if (selectionChangeRaf.current) {
        cancelAnimationFrame(selectionChangeRaf.current)
      }
      selectionChangeRaf.current = requestAnimationFrame(() => {
        selectionChangeRaf.current = null

        const selection = document.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          setSelectedVocabText('')
          return
        }

        const container = questionContentRef.current
        const anchorNode = selection.anchorNode
        const focusNode = selection.focusNode

        const withinContainer =
          !!container &&
          ((anchorNode && container.contains(anchorNode)) ||
            (focusNode && container.contains(focusNode)))

        if (!withinContainer) {
          setSelectedVocabText('')
          return
        }

        const normalized = selection.toString().replace(/\s+/g, ' ').trim()

        if (normalized.length < 2 || normalized.length > 80) {
          setSelectedVocabText('')
          return
        }

        setSelectedVocabText(normalized)
      })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      if (selectionChangeRaf.current) {
        cancelAnimationFrame(selectionChangeRaf.current)
        selectionChangeRaf.current = null
      }
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [questionContentRef])

  const handleAddSelectionToVocab = async () => {
    if (!selectedVocabText || isAddingVocab) return

    setIsAddingVocab(true)
    try {
      const result = await autoAddToVocab(selectedVocabText, exam.title, exam.id)
      if (result.success) {
        toast.success(result.message)
        setSelectedVocabText('')
        window.getSelection()?.removeAllRanges()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Failed to add to vocabulary:', error)
      toast.error('단어를 추가하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setIsAddingVocab(false)
    }
  }

  const vocabButtonDisabled =
    status !== 'in_progress' || (timeExpiredRef.current ?? false)

  const vocabPreview = selectedVocabText
    ? selectedVocabText.length > 40
      ? `${selectedVocabText.slice(0, 37)}…`
      : selectedVocabText
    : undefined

  const moduleDisplayLabel =
    (currentModule.module as string) === 'practice'
      ? 'Practice Mode'
      : (currentModule.module as string) === 'tcf_reading'
      ? 'TCF 독해'
      : currentModule.module.replace(/(\d)/, ' $1').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      {/* Header with Timer */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-100/70 shadow-[0_1px_10px_rgba(0,0,0,0.05)] px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onExitAttempt}
              className="text-gray-500 hover:text-gray-700 text-sm shrink-0"
            >
              ←{' '}
              <span className="hidden sm:inline">
                {exam.title.includes('Practice') ? 'Exit Practice' : 'Exit Exam'}
              </span>
            </button>
            <ReferenceSheetModal />
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {exam.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <HighlightToolbar
              isHighlightMode={isHighlightMode}
              onToggleMode={toggleHighlightMode}
              onClearAll={clearAllHighlights}
              highlightCount={(highlightsByQuestion[currentQuestion.id] || []).length}
              disabled={vocabButtonDisabled}
              canAddToVocab={Boolean(selectedVocabText)}
              onAddToVocab={handleAddSelectionToVocab}
              isAddingToVocab={isAddingVocab}
              selectedSnippet={vocabPreview}
            />
            <ExamTimer
              initialTimeSeconds={currentModule.timeRemaining}
              onTimeExpired={onTimeExpired}
              onTimeUpdate={onTimeUpdate}
              isPaused={status !== 'in_progress'}
            />
          </div>
        </div>
      </div>

      {/* Main Question Area */}
      <div className="flex-1 overflow-x-hidden relative">
        <QuestionDisplay
          question={currentQuestion}
          questionNumber={currentModule.currentQuestionIndex + 1}
          totalQuestions={currentModule.questions.length}
          userAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          disabled={
            status !== 'in_progress' || (timeExpiredRef.current ?? false)
          }
          isAdminPreview={false}
          isMarkedForReview={isMarkedForReview()}
          onToggleMarkForReview={toggleMarkForReview}
          questionContentRef={questionContentRef}
          highlights={highlightsByQuestion[currentQuestion.id] || []}
          onRemoveHighlight={(highlight) =>
            removeHighlight(currentQuestion.id, highlight)
          }
          onAddHighlight={(highlight) =>
            addHighlight(currentQuestion.id, highlight)
          }
          showPerQuestionAnswers={answerCheckMode === 'per_question'}
          isAnswerSubmitted={showAnswerReveal}
          isCorrect={answerRevealData?.isCorrect}
          onContinueAfterAnswer={onAnswerRevealContinue}
          onCheckAnswer={onCheckAnswer}
          onTryAgain={onTryAgain}
          showCorrectAnswer={shouldShowCorrectAnswer}
          module={currentModule.module}
          isPaused={
            status !== 'in_progress' || (timeExpiredRef.current ?? false)
          }
          examTitle={exam.title}
          examId={exam.id}
          isHighlightMode={isHighlightMode}
        />
      </div>

      {/* Bottom Navigation */}
      <ExamNavigation
        currentQuestion={currentModule.currentQuestionIndex + 1}
        totalQuestions={currentModule.questions.length}
        currentModule={currentModule.module}
        hasAnswer={!!currentAnswer}
        isLastQuestion={isLastQuestion}
        isLastModule={isLastModule}
        onNext={onNext}
        onPrevious={onPrevious}
        onGoToQuestion={onGoToQuestion}
        onSubmitModule={onSubmitModule}
        onSubmitExam={onSubmitExam}
        answeredQuestions={getAnsweredQuestions()}
        markedQuestions={getMarkedQuestions()}
        disabled={status !== 'in_progress' || (timeExpiredRef.current ?? false)}
        isAdminPreview={false}
      />

      {/* Time Expired Overlay */}
      {status === 'time_expired' && (
        <TimeExpiredOverlay
          isLastModule={currentModuleIndex >= modules.length - 1}
        />
      )}
    </div>
  )
}
