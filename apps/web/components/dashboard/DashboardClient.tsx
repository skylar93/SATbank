'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '../../contexts/auth-context'
import { type TestAttempt } from '../../lib/exam-service'
import {
  ProgressChart,
  SubjectPerformanceChart,
  WeeklyActivityChart,
} from '../charts'
import { ModernScoreProgress, StatsCard } from '../modern-charts'
import { Calendar } from '../calendar'
import SmartReviewWidget from './SmartReviewWidget'
import {
  ChartBarIcon,
  ChevronDownIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import { formatTimeAgo } from '../../lib/utils'

interface AssignmentTask {
  assignmentId: string
  examId: string
  examTitle: string
  status: 'not_started' | 'in_progress' | 'completed'
  assignedAt: string | null
  dueDate: string | null
  lastActivityAt: string | null
  isOverdue: boolean
  isDueSoon: boolean
  progressPercent: number
  totalQuestions: number | null
  estimatedMinutes: number | null
}

interface MistakeSummary {
  total: number
  unmastered: number
  mastered: number
  lastReviewedAt: string | null
  countsByExam: Array<{
    examId: string | null
    examTitle: string
    count: number
  }>
  countsByModule: Array<{
    module: string
    count: number
  }>
}

interface VocabSummary {
  dueToday: number
  totalWords: number
  nextReviewAt: string | null
  reviewSets: Array<{
    id: number | string
    title: string
    count: number
  }>
}

interface DashboardData {
  overallStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  scoreHistory: Array<{
    date: string
    score: number
  }>
  recentAttempts: TestAttempt[]
  previousMonthStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  activityDays: string[]
  weeklyActivity: {
    days: string[]
    studyTime: number[]
    practiceTests: number[]
  }
  subjectScores: {
    reading: number
    writing: number
    math: number
  }
  assignments: AssignmentTask[]
  mistakeSummary: MistakeSummary
  vocabSummary: VocabSummary
}

interface DashboardClientProps {
  initialData?: DashboardData
  canShowResults?: boolean
}

export default function DashboardClient({
  initialData,
  canShowResults = true,
}: DashboardClientProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(!initialData)
  const [expandedCard, setExpandedCard] = useState<
    'assignments' | 'mistakes' | 'vocab' | null
  >(null)

  // Use initial data or fallback to empty state
  const data = initialData || {
    overallStats: { examsTaken: 0, bestScore: null, averageScore: null },
    scoreHistory: [],
    recentAttempts: [],
    previousMonthStats: { examsTaken: 0, bestScore: null, averageScore: null },
    activityDays: [],
    weeklyActivity: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      studyTime: [0, 0, 0, 0, 0, 0, 0],
      practiceTests: [0, 0, 0, 0, 0, 0, 0],
    },
    subjectScores: { reading: 0, writing: 0, math: 0 },
    assignments: [],
    mistakeSummary: {
      total: 0,
      unmastered: 0,
      mastered: 0,
      lastReviewedAt: null,
      countsByExam: [],
      countsByModule: [],
    },
    vocabSummary: {
      dueToday: 0,
      totalWords: 0,
      nextReviewAt: null,
      reviewSets: [],
    },
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculatePercentageChange = (
    current: number | null,
    previous: number | null
  ): { change: string; isZero: boolean } => {
    if (!current || !previous || previous === 0) {
      return { change: '0%', isZero: true }
    }
    const change = ((current - previous) / previous) * 100
    const prefix = change >= 0 ? '+' : ''
    return { change: `${prefix}${change.toFixed(1)}%`, isZero: false }
  }

  // Real data for score progress chart with fallback for empty data
  const hasScoreData = data.scoreHistory.length > 0
  const progressData = hasScoreData
    ? {
        labels: data.scoreHistory.map((item) => {
          const date = new Date(item.date)
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        }),
        datasets: [
          {
            label: 'Overall Score',
            data: data.scoreHistory.map((item) => item.score),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
          },
        ],
      }
    : {
        labels: ['Take your first exam'],
        datasets: [
          {
            label: 'Overall Score',
            data: [0],
            borderColor: '#e5e7eb',
            backgroundColor: 'rgba(229, 231, 235, 0.1)',
            fill: true,
          },
        ],
      }

  if (!user) return null

  const formatDueLabel = (dueDate: string | null, isOverdue: boolean) => {
    if (!dueDate) return 'No due date'
    const due = new Date(dueDate)
    const diffMs = due.getTime() - Date.now()
    const dayMs = 1000 * 60 * 60 * 24
    const diffDays = Math.round(diffMs / dayMs)

    if (isOverdue) {
      return diffDays === 0
        ? 'Due today'
        : `${Math.abs(diffDays)}d overdue`
    }

    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return 'Due tomorrow'
    if (diffDays < 7) return `Due in ${diffDays}d`
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatRelativeTime = (isoString: string) => {
    const target = new Date(isoString).getTime()
    const diffMs = target - Date.now()
    if (diffMs <= 0) return 'Now'
    const minutes = Math.floor(diffMs / (1000 * 60))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    }
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const assignmentsSorted = [...data.assignments].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (b.status === 'completed' && a.status !== 'completed') return -1
    if (a.isOverdue && !b.isOverdue) return -1
    if (!a.isOverdue && b.isOverdue) return 1
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
    if (aDue !== bDue) return aDue - bDue
    const aAssigned = a.assignedAt ? new Date(a.assignedAt).getTime() : Number.POSITIVE_INFINITY
    const bAssigned = b.assignedAt ? new Date(b.assignedAt).getTime() : Number.POSITIVE_INFINITY
    return aAssigned - bAssigned
  })

  const incompleteAssignments = assignmentsSorted.filter(
    (assignment) => assignment.status !== 'completed'
  )
  const overdueAssignments = incompleteAssignments.filter(
    (assignment) => assignment.isOverdue
  )
  const assignmentPreview = incompleteAssignments.slice(0, 3)
  const assignmentDisplayList = incompleteAssignments

  const assignmentSummaryText = (() => {
    if (incompleteAssignments.length === 0) {
      return 'All assigned exams are completed!'
    }
    if (overdueAssignments.length > 0) {
      const count = overdueAssignments.length
      return `${count} assigned exam${count === 1 ? '' : 's'} are overdue. Jump back in now.`
    }
    const nextDue = assignmentPreview[0]
    if (nextDue?.dueDate) {
      return `Next exam due: ${formatDueLabel(nextDue.dueDate, nextDue.isOverdue)}.`
    }
    const remaining = incompleteAssignments.length
    return `${remaining} assigned exam${remaining === 1 ? '' : 's'} remaining.`
  })()

  const renderAssignmentDetails = () => {
    if (assignmentPreview.length === 0) {
      return (
        <div className="rounded-xl bg-white border border-violet-100 p-4 text-sm text-gray-600">
          All assigned exams are done. When new ones arrive, you’ll see them here.
        </div>
      )
    }

    return (
      <div
        className={`space-y-3 ${
          assignmentDisplayList.length > 4 ? 'max-h-80 overflow-y-auto pr-1' : ''
        }`}
      >
        {assignmentDisplayList.map((assignment) => (
          <div
            key={assignment.assignmentId}
            className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {assignment.examTitle}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {assignment.totalQuestions
                    ? `${assignment.totalQuestions} questions`
                    : 'Question count unavailable'}
                  {assignment.estimatedMinutes
                    ? ` • ~${assignment.estimatedMinutes} min`
                    : ''}
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  assignment.isOverdue
                    ? 'bg-red-100 text-red-700'
                    : assignment.status === 'in_progress'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {assignment.isOverdue
                  ? 'Overdue'
                  : assignment.status === 'in_progress'
                    ? 'In progress'
                    : 'Not started'}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{formatDueLabel(assignment.dueDate, assignment.isOverdue)}</span>
              {assignment.lastActivityAt && (
                <span>
                  Last activity:{' '}
                  {new Date(assignment.lastActivityAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-violet-100">
              <div
                className={`h-full ${
                  assignment.status === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'
                }`}
                style={{ width: `${assignment.progressPercent}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-violet-600">
                {assignment.status === 'completed'
                  ? 'Completed'
                  : `${assignment.progressPercent}% complete`}
              </span>
              <Link
                href={`/student/exam/${assignment.examId}`}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700"
              >
                {assignment.status === 'in_progress' ? 'Continue' : 'Start'} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const mistakeSummary = data.mistakeSummary
  const topMistakeExam = mistakeSummary.countsByExam[0]
  const topMistakeModule = mistakeSummary.countsByModule[0]

  const mistakeSummaryText = (() => {
    if (mistakeSummary.unmastered === 0) {
      return 'You’ve mastered every mistake! Keep it up 🎉'
    }
    if (topMistakeExam) {
      const count = topMistakeExam.count
      return `Review ${count} question${count === 1 ? '' : 's'} from ${topMistakeExam.examTitle}.`
    }
    if (topMistakeModule) {
      const count = topMistakeModule.count
      return `Focus on ${count} question${count === 1 ? '' : 's'} in ${topMistakeModule.module} next.`
    }
    const count = mistakeSummary.unmastered
    return `${count} mistake question${count === 1 ? '' : 's'} still need attention.`
  })()

  const renderMistakeDetails = () => {
    if (mistakeSummary.total === 0) {
      return (
        <div className="rounded-xl bg-white border border-rose-100 p-4 text-sm text-gray-600">
          No mistakes logged yet. Once you miss questions, they’ll appear here automatically.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-100 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-900">Unmastered</span>
            <span className="text-rose-600 font-semibold">
              {mistakeSummary.unmastered} / {mistakeSummary.total}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full bg-rose-500"
              style={{
                width: `${mistakeSummary.total === 0 ? 0 : Math.round((mistakeSummary.unmastered / mistakeSummary.total) * 100)}%`,
              }}
            />
          </div>
          {mistakeSummary.lastReviewedAt && (
            <p className="mt-2 text-xs text-gray-500">
              Last review:{' '}
              {new Date(mistakeSummary.lastReviewedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        {mistakeSummary.countsByExam.length > 0 && (
          <div className="rounded-xl border border-rose-100 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Mistakes by exam
            </h4>
            <div className="mt-2 space-y-2">
              {mistakeSummary.countsByExam.slice(0, 3).map((group) => (
                <div
                  key={`${group.examId ?? 'unlinked'}-${group.examTitle}`}
                  className="flex items-center justify-between text-sm text-gray-700"
                >
                  <span className="truncate">{group.examTitle}</span>
                  <span className="font-semibold text-rose-600">{group.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/student/mistake-notebook"
          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
        >
          Open Mistake Notebook →
        </Link>
      </div>
    )
  }

  const vocabSummary = data.vocabSummary
  const vocabSummaryText = (() => {
    if (vocabSummary.totalWords === 0) {
      return 'No vocabulary yet. Create your first set to get started.'
    }
    if (vocabSummary.dueToday === 0) {
      return 'No vocab reviews due today—nice work keeping up!'
    }
    const count = vocabSummary.dueToday
    return `${count} word${count === 1 ? '' : 's'} to review today. Ready to dive in?`
  })()

  const renderVocabDetails = () => {
    if (vocabSummary.totalWords === 0) {
      return (
        <div className="rounded-xl bg-white border border-amber-100 p-4 text-sm text-gray-600">
          Add words to start Smart Review. Vocab sets keep practice separate from mistakes.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-100 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Today&apos;s reviews</span>
            <span className="font-semibold text-amber-600">
              {vocabSummary.dueToday}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Out of {vocabSummary.totalWords} total word{vocabSummary.totalWords === 1 ? '' : 's'}, these need review.
          </p>
        </div>

        {vocabSummary.reviewSets.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Sets with reviews due
            </h4>
            <div className="mt-2 space-y-2">
              {vocabSummary.reviewSets.slice(0, 3).map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between text-sm text-gray-700"
                >
                  <span className="truncate">{set.title}</span>
                  <span className="font-semibold text-amber-600">{set.count}</span>
                </div>
              ))}
              {vocabSummary.reviewSets.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{vocabSummary.reviewSets.length - 3} more sets
                </p>
              )}
            </div>
          </div>
        )}

        {vocabSummary.nextReviewAt && (
          <p className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-gray-600">
            Next review available in {formatRelativeTime(vocabSummary.nextReviewAt)}
          </p>
        )}

        <Link
          href="/student/vocab"
          className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-100"
        >
          Start vocab review →
        </Link>
      </div>
    )
  }

  const toneStyles = {
    violet: {
      border: 'border-violet-100/80',
      badge: 'bg-white/70 text-violet-700 border border-violet-100/60 shadow-sm',
      summary: 'text-violet-800',
      hover: 'hover:shadow-lg hover:-translate-y-0.5',
      step: 'bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-md',
      cta: 'text-violet-700 hover:text-violet-900',
      gradient: 'from-violet-50 via-white to-purple-50',
    },
    rose: {
      border: 'border-rose-100/80',
      badge: 'bg-white/70 text-rose-700 border border-rose-100/60 shadow-sm',
      summary: 'text-rose-800',
      hover: 'hover:shadow-lg hover:-translate-y-0.5',
      step: 'bg-gradient-to-br from-rose-600 to-pink-500 text-white shadow-md',
      cta: 'text-rose-700 hover:text-rose-900',
      gradient: 'from-rose-50 via-white to-pink-50',
    },
    amber: {
      border: 'border-amber-100/80',
      badge: 'bg-white/70 text-amber-700 border border-amber-100/60 shadow-sm',
      summary: 'text-amber-800',
      hover: 'hover:shadow-lg hover:-translate-y-0.5',
      step: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md',
      cta: 'text-amber-700 hover:text-amber-900',
      gradient: 'from-amber-50 via-white to-yellow-50',
    },
  } as const

  type TaskTone = (typeof toneStyles)[keyof typeof toneStyles]

  const nextAssignment = assignmentPreview[0]
  const assignmentsCta =
    incompleteAssignments.length === 0
      ? { label: 'View exam history', href: '/student/exams' }
      : nextAssignment && nextAssignment.examId
        ? {
            label:
              nextAssignment.status === 'in_progress'
                ? 'Continue exam'
                : 'Start next exam',
            href: `/student/exam/${nextAssignment.examId}`,
          }
        : { label: 'View assignments', href: '/student/exams' }

  const mistakesCta = {
    label:
      mistakeSummary.unmastered === 0
        ? 'Review notebook'
        : 'Open Mistake Notebook',
    href: '/student/mistake-notebook',
  }

  const vocabCta = {
    label:
      vocabSummary.totalWords === 0
        ? 'Create vocab set'
        : 'Start vocab review',
    href: '/student/vocab',
  }

  const taskCards: Array<{
    id: 'assignments' | 'mistakes' | 'vocab'
    title: string
    badge: string
    tone: keyof typeof toneStyles
    summary: string
    details: () => JSX.Element
    cta: { label: string; href: string }
  }> = [
    {
      id: 'assignments',
      title: 'Assigned Exams',
      badge:
        incompleteAssignments.length === 0
          ? 'Done'
          : `${incompleteAssignments.length} left`,
      tone: 'violet',
      summary: assignmentSummaryText,
      details: renderAssignmentDetails,
      cta: assignmentsCta,
    },
    {
      id: 'mistakes',
      title: 'Mistake Notebook',
      badge:
        mistakeSummary.unmastered === 0
          ? 'Done'
          : `${mistakeSummary.unmastered} to go`,
      tone: 'rose',
      summary: mistakeSummaryText,
      details: renderMistakeDetails,
      cta: mistakesCta,
    },
    {
      id: 'vocab',
      title: 'Vocabulary',
      badge:
        vocabSummary.totalWords === 0
          ? 'Get started'
          : vocabSummary.dueToday === 0
            ? 'Done'
            : `${vocabSummary.dueToday} due`,
      tone: 'amber',
      summary: vocabSummaryText,
      details: renderVocabDetails,
      cta: vocabCta,
    },
  ]

  interface TaskStepProps {
    step: number
    title: string
    summary: string
    badge: string
    tone: TaskTone
    isExpanded: boolean
    onToggle: () => void
    cta?: { label: string; href: string }
    children: ReactNode
    className?: string
  }

  const TaskStep = ({
    step,
    title,
    summary,
    badge,
    tone,
    isExpanded,
    onToggle,
    cta,
    children,
    className = '',
  }: TaskStepProps) => (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white/80 backdrop-blur transition ${tone.border} ${tone.hover} ${className}`.trim()}
    >
      <div className={`absolute inset-0 opacity-70 bg-gradient-to-r ${tone.gradient}`}></div>
      <div className="relative flex flex-col gap-4 px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tone.step}`}
            >
              Step {step}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {title}
              </p>
              <p
                className={`mt-1 text-base font-semibold leading-relaxed text-gray-900`}
              >
                {summary}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex flex-none items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}
          >
            {badge}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          {cta ? (
            <Link
              href={cta.href}
              className={`inline-flex items-center gap-1 font-semibold ${tone.cta}`}
            >
              {cta.label}
              <ChevronDownIcon className="h-3.5 w-3.5 -rotate-90" />
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900"
          >
            <span>{isExpanded ? 'Hide details' : 'See details'}</span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="relative border-t border-white/70 px-4 pb-5 md:px-6">
          <div className="pt-4 text-sm text-gray-600">{children}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-4 md:px-6 py-4 md:py-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Hello {user.profile?.full_name?.split(' ')[0] || 'there'}, welcome
              back
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm md:text-base">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-4 md:p-6">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Column - 9 cols */}
          <div className="lg:col-span-9 space-y-4 md:space-y-6">
            {/* Priority Tasks */}
            <section>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 md:px-5">
                  <h2 className="text-base font-semibold text-gray-900 md:text-lg">
                    Today's Plan
                  </h2>
                  <span className="text-xs text-gray-400 md:text-sm">
                    Work through these steps in order.
                  </span>
                </div>
                <div className="space-y-3 px-4 py-4 md:space-y-4 md:px-5">
                  {taskCards.map((card, index) => {
                    const isExpanded = expandedCard === card.id
                    const tone = toneStyles[card.tone]

                    return (
                      <TaskStep
                        key={card.id}
                        step={index + 1}
                        title={card.title}
                        summary={card.summary}
                        badge={card.badge}
                        tone={tone}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedCard((prev) =>
                            prev === card.id ? null : card.id
                          )
                        }
                        cta={card.cta}
                      >
                        {card.details()}
                      </TaskStep>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StatsCard
                title="Your Score This Month"
                value={
                  loading
                    ? '...'
                    : !canShowResults
                      ? 'Results Hidden'
                      : data.overallStats.bestScore || 'No scores yet'
                }
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.bestScore,
                    data.previousMonthStats.bestScore
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.bestScore,
                    data.previousMonthStats.bestScore
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.bestScore &&
                    data.previousMonthStats.bestScore &&
                    data.overallStats.bestScore >=
                      data.previousMonthStats.bestScore
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data:
                    canShowResults && data.scoreHistory.length > 0
                      ? data.scoreHistory.slice(-6).map((item) => item.score)
                      : [0, 0, 0, 0, 0, 0],
                  color: '#10b981',
                }}
              />

              <StatsCard
                title="Total Exams"
                value={data.overallStats.examsTaken}
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.examsTaken,
                    data.previousMonthStats.examsTaken
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.examsTaken,
                    data.previousMonthStats.examsTaken
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.examsTaken >=
                    data.previousMonthStats.examsTaken
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data: Array.from({ length: 6 }, (_, i) =>
                    Math.max(0, data.overallStats.examsTaken - 5 + i)
                  ),
                  color: '#8b5cf6',
                }}
              />

              <StatsCard
                title="Average Score"
                value={
                  loading
                    ? '...'
                    : !canShowResults
                      ? 'Results Hidden'
                      : data.overallStats.averageScore || 'No scores yet'
                }
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.averageScore,
                    data.previousMonthStats.averageScore
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.averageScore,
                    data.previousMonthStats.averageScore
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.averageScore &&
                    data.previousMonthStats.averageScore &&
                    data.overallStats.averageScore >=
                      data.previousMonthStats.averageScore
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data:
                    canShowResults && data.scoreHistory.length > 0
                      ? data.scoreHistory.slice(-6).map((item) => item.score)
                      : [0, 0, 0, 0, 0, 0],
                  color: '#f59e0b',
                }}
              />
            </div>

            {/* Score Progress Chart - Full Width */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  Score Progress
                </h3>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-600 rounded-lg">
                    This Week
                  </button>
                  <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">
                    Last Week
                  </button>
                </div>
              </div>
              {!canShowResults ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Results Currently Hidden
                  </h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Your instructor has chosen to hide exam results for now.
                  </p>
                </div>
              ) : hasScoreData ? (
                <ModernScoreProgress data={progressData} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    No Score History Yet
                  </h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Take your first practice exam to see your progress over
                    time.
                  </p>
                  <Link
                    href="/student/exams"
                    className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Take Practice Exam
                  </Link>
                </div>
              )}
            </div>

            {/* Weekly Activity */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  Weekly Activity
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">This Week</span>
                  <select className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                    <option>This Week</option>
                    <option>Last Week</option>
                    <option>This Month</option>
                  </select>
                </div>
              </div>
              <WeeklyActivityChart data={data.weeklyActivity} />
            </div>
          </div>

          {/* Right Column - 3 cols */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            {/* Smart Review Widget */}
            <SmartReviewWidget />

            {/* Calendar */}
            <Calendar
              events={data.activityDays.map((date) => ({
                date: new Date(date),
                type: 'visit' as const,
              }))}
            />

            {/* Subject Performance */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Skill Balance
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Reading/Writing vs Math snapshot
                  </p>
                </div>
                <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                  Live
                </span>
              </div>
              <SubjectPerformanceChart data={data.subjectScores} />
            </div>

            {/* Latest Activities */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Latest Activities
                </h3>
                <button className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-4">
                {data.recentAttempts.slice(0, 3).map((attempt, index) => {
                  return (
                    <div
                      key={attempt.id}
                      className="flex items-center space-x-3"
                    >
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        <span className="text-violet-600 font-semibold text-sm">
                          {canShowResults
                            ? (attempt.final_scores?.overall ??
                              attempt.total_score ??
                              'N/A')
                            : '***'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          SAT Practice Test
                        </p>
                        <p className="text-xs text-gray-500">
                          {attempt.completed_at
                            ? formatDate(attempt.completed_at)
                            : 'In Progress'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {attempt.completed_at
                          ? formatTimeAgo(attempt.completed_at)
                          : 'In progress'}
                      </span>
                    </div>
                  )
                })}

                {data.recentAttempts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Take your first exam to see progress here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-4 md:p-6 text-white">
              <div className="text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <FireIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  Keep Your Streak!
                </h3>
                <p className="text-blue-100 text-sm mb-3 md:mb-4">
                  You're doing great! Continue your daily practice to reach your
                  target score.
                </p>
                <button className="bg-white text-blue-600 font-semibold py-2 px-4 md:px-6 rounded-lg hover:bg-blue-50 transition-colors text-sm md:text-base">
                  Continue Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
