'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, BookOpen, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getTodayReviewCount,
  getVocabSetsWithReviewsDue,
} from '@/lib/vocab-service'
import Link from 'next/link'

interface SmartReviewData {
  reviewCount: number
  totalWords: number
  nextReviewTime?: Date
  reviewSets: Array<{
    id: number
    title: string
    count: number
  }>
}

export default function SmartReviewWidget() {
  const [reviewData, setReviewData] = useState<SmartReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  // Use the centralized Supabase client

  useEffect(() => {
    fetchReviewData()
  }, [])

  const fetchReviewData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Use the new vocab service functions
      const [reviewCount, reviewSets] = await Promise.all([
        getTodayReviewCount(user.id),
        getVocabSetsWithReviewsDue(user.id),
      ])

      // Get total word count from vocab_entries
      const { count: totalWords } = await supabase
        .from('vocab_entries')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)

      // Get next upcoming review from user_vocab_progress
      const { data: nextReview } = await supabase
        .from('user_vocab_progress')
        .select('next_review_date')
        .eq('user_id', user.id)
        .gt('next_review_date', new Date().toISOString())
        .order('next_review_date', { ascending: true })
        .limit(1)
        .single()

      setReviewData({
        reviewCount,
        totalWords: totalWords || 0,
        reviewSets,
        nextReviewTime: nextReview
          ? new Date(nextReview.next_review_date)
          : undefined,
      })
    } catch (error) {
      console.error('Error fetching review data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeUntilNext = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''}`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m`
    } else {
      return 'Now'
    }
  }

  const LoadingCard = () => (
    <div className="rounded-2xl border border-violet-100 bg-white/70 p-6 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  )

  if (loading) {
    return <LoadingCard />
  }

  if (!reviewData || reviewData.totalWords === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6 text-center shadow-sm">
        <BookOpen className="h-12 w-12 text-violet-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Build your first deck
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Start a vocabulary set to unlock Smart Review insights.
        </p>
        <Link href="/student/vocab">
          <Button variant="outline" className="border-violet-200 text-violet-700">
            Create Vocabulary Set
          </Button>
        </Link>
      </div>
    )
  }

  const StatChip = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )

  const shellClass =
    reviewData.reviewCount > 0
      ? 'from-violet-50 via-white to-blue-50'
      : 'from-emerald-50 via-white to-green-50'

  return (
    <div className={`rounded-2xl border border-violet-100/70 bg-gradient-to-br ${shellClass} p-6 shadow-sm`}> 
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Smart Review (SRS)
          </p>
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            Personalized practice
          </h3>
        </div>
        <Link href="/student/vocab" className="text-xs font-medium text-violet-600 hover:text-violet-800">
          Manage vocabulary →
        </Link>
      </div>

      {reviewData.reviewCount > 0 ? (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Ready today
              </p>
              <p className="text-4xl font-bold text-violet-700">
                {reviewData.reviewCount}
              </p>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
              {reviewData.reviewSets.length} set
              {reviewData.reviewSets.length === 1 ? '' : 's'} due
            </span>
          </div>

          {reviewData.reviewSets.length > 0 && (
            <div className="grid gap-2">
              {reviewData.reviewSets.slice(0, 3).map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-xl border border-white/70 bg-white/60 px-4 py-2 text-sm text-gray-700"
                >
                  <span className="truncate">{set.title}</span>
                  <span className="font-semibold text-violet-600">{set.count}</span>
                </div>
              ))}
            </div>
          )}

          <Link href="/student/vocab/quiz?pool=smart_review&type=term_to_def&format=multiple_choice">
            <Button className="w-full bg-violet-600 hover:bg-violet-700">
              Start Smart Review
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-white/70 px-4 py-3">
            <div className="text-lg font-semibold text-emerald-700">
              All caught up! 🎉
            </div>
            <p className="text-sm text-emerald-700/80">
              You've reviewed all {reviewData.totalWords} words.
            </p>
            {reviewData.nextReviewTime && (
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5" />
                Next review in {formatTimeUntilNext(reviewData.nextReviewTime)}
              </div>
            )}
          </div>
          <Link href="/student/vocab">
            <Button variant="outline" className="w-full border-emerald-200 text-emerald-700">
              Browse word library
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatChip label="Total words" value={`${reviewData.totalWords}`} />
        <StatChip
          label="Due today"
          value={`${reviewData.reviewCount || 0}`}
        />
        <StatChip
          label="Next review"
          value={
            reviewData.nextReviewTime
              ? formatTimeUntilNext(reviewData.nextReviewTime)
              : 'Scheduled'
          }
        />
      </div>
    </div>
  )
}
