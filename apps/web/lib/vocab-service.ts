import { supabase } from '@/lib/supabase'

const isMissingRelationError = (error: any) => {
  if (!error) return false
  return (
    error.code === '42P01' ||
    (typeof error.message === 'string' &&
      error.message.toLowerCase().includes('does not exist'))
  )
}

const countDueFromEntries = async (userId: string, nowISO: string) => {
  const { count, error } = await supabase
    .from('vocab_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review_date', nowISO)

  if (error) {
    console.error('Fallback vocab entry count failed:', error)
    return 0
  }

  return count || 0
}

const getDueSetsFromEntries = async (userId: string, nowISO: string) => {
  const { data, error } = await supabase
    .from('vocab_entries')
    .select(
      `
      set_id,
      next_review_date,
      vocab_sets!inner(
        id,
        title
      )
    `
    )
    .eq('user_id', userId)
    .lte('next_review_date', nowISO)

  if (error) {
    console.error('Fallback vocab set lookup failed:', error)
    return []
  }

  const map = new Map()
  data?.forEach((entry: any) => {
    const setId = entry.vocab_sets?.id || entry.set_id
    if (!setId) return
    const title = entry.vocab_sets?.title || 'Untitled Set'
    if (map.has(setId)) {
      map.get(setId).count += 1
    } else {
      map.set(setId, { id: setId, title, count: 1 })
    }
  })

  return Array.from(map.values())
}

/**
 * Gets the count of words due for review today based on SRS algorithm
 */
export async function getTodayReviewCount(userId: string): Promise<number> {
  // Use the centralized Supabase client

  const nowISO = new Date().toISOString()
  try {
    const { count, error } = await supabase
      .from('user_vocab_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_date', nowISO)

    if (error) {
      if (isMissingRelationError(error)) {
        return await countDueFromEntries(userId, nowISO)
      }
      console.error('Error fetching today review count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    if (isMissingRelationError(error)) {
      return await countDueFromEntries(userId, nowISO)
    }
    console.error('Error in getTodayReviewCount:', error)
    return 0
  }
}

/**
 * Gets vocabulary sets that have words due for review today
 */
export async function getVocabSetsWithReviewsDue(userId: string) {
  // Use the centralized Supabase client

  const nowISO = new Date().toISOString()
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
      .lte('next_review_date', nowISO)

    if (error) {
      if (isMissingRelationError(error)) {
        return await getDueSetsFromEntries(userId, nowISO)
      }
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
    if (isMissingRelationError(error)) {
      return await getDueSetsFromEntries(userId, nowISO)
    }
    console.error('Error in getVocabSetsWithReviewsDue:', error)
    return []
  }
}
