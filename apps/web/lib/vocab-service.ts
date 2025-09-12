import { supabase } from '@/lib/supabase'

/**
 * Gets the count of words due for review today based on SRS algorithm
 */
export async function getTodayReviewCount(userId: string): Promise<number> {
  // Use the centralized Supabase client

  try {
    const { count, error } = await supabase
      .from('user_vocab_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', new Date().toISOString())

    if (error) {
      console.error('Error fetching today review count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error in getTodayReviewCount:', error)
    return 0
  }
}

/**
 * Gets vocabulary sets that have words due for review today
 */
export async function getVocabSetsWithReviewsDue(userId: string) {
  // Use the centralized Supabase client

  try {
    const { data, error } = await supabase
      .from('user_vocab_progress')
      .select(
        `
        vocab_entries!inner(
          set_id,
          vocab_sets!inner(
            id,
            title
          )
        )
      `
      )
      .eq('user_id', userId)
      .lte('next_review_date', new Date().toISOString())

    if (error) {
      console.error('Error fetching vocab sets with reviews due:', error)
      return []
    }

    // Group by vocab set and count reviews
    const setReviewCounts = new Map()

    data?.forEach((progress: any) => {
      const setId = progress.vocab_entries.set_id
      const setTitle = progress.vocab_entries.vocab_sets.title

      if (setReviewCounts.has(setId)) {
        setReviewCounts.get(setId).count += 1
      } else {
        setReviewCounts.set(setId, {
          id: setId,
          title: setTitle,
          count: 1,
        })
      }
    })

    return Array.from(setReviewCounts.values())
  } catch (error) {
    console.error('Error in getVocabSetsWithReviewsDue:', error)
    return []
  }
}
