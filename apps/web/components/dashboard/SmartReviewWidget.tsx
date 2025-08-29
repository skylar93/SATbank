'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, BookOpen, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase'
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
  const supabase = createClient()

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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!reviewData || reviewData.totalWords === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No vocabulary yet
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Start building your vocabulary to use Smart Review
          </p>
          <Link href="/student/vocab">
            <Button variant="outline">Create Vocabulary Set</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={
        reviewData.reviewCount > 0
          ? 'border-blue-200 bg-blue-50'
          : 'border-green-200 bg-green-50'
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-blue-600" />
          Smart Review (SRS)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {reviewData.reviewCount > 0 ? (
          <div>
            <div className="mb-4">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {reviewData.reviewCount}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                word{reviewData.reviewCount !== 1 ? 's' : ''} ready for review
              </p>

              {/* Show vocab sets with reviews due */}
              {reviewData.reviewSets.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    From your sets:
                  </p>
                  {reviewData.reviewSets.slice(0, 2).map((set) => (
                    <div
                      key={set.id}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="text-gray-600 truncate">
                        {set.title}
                      </span>
                      <span className="text-blue-600 font-medium">
                        {set.count}
                      </span>
                    </div>
                  ))}
                  {reviewData.reviewSets.length > 2 && (
                    <p className="text-xs text-gray-400">
                      +{reviewData.reviewSets.length - 2} more sets
                    </p>
                  )}
                </div>
              )}
            </div>
            <Link href="/student/vocab/quiz?pool=smart_review&type=term_to_def&format=multiple_choice">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Start Smart Review
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <div className="text-2xl font-bold text-green-600 mb-1">
                All caught up! 🎉
              </div>
              <p className="text-sm text-gray-600 mb-2">
                You've reviewed all {reviewData.totalWords} words
              </p>
              {reviewData.nextReviewTime && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  Next review in{' '}
                  {formatTimeUntilNext(reviewData.nextReviewTime)}
                </div>
              )}
            </div>
            <Link href="/student/vocab">
              <Button variant="outline" className="w-full">
                Manage Vocabulary
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
