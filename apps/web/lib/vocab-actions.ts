'use server'

import { revalidatePath } from 'next/cache'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { type Database } from '../../../packages/database-types/src/index'
import {
  type BulkWord,
  type SRSUpdateParams,
  type SmartReviewWord,
  type QuizResult,
  type BulkAddResponse,
  type SmartReviewResponse,
  type SmartReviewCountResponse,
  type CreateSetResponse,
  type ProcessQuizResultsResponse,
  type VocabActionResponse,
  SRS_CONFIG,
} from '@/types/vocab.types'
import {
  verifyVocabSetOwner,
  verifyAuthenticated,
  verifyVocabEntryOwner,
  handleServerActionError,
} from '@/lib/auth-utils.server'
import { handleApiError, createErrorResponse } from '@/lib/error-handler'

export async function addWordsInBulk(
  setId: number,
  words: BulkWord[]
): Promise<BulkAddResponse> {
  try {
    if (!words || words.length === 0) {
      return { success: false, message: 'No words to add.' }
    }

    const { user, supabase } = await verifyVocabSetOwner(setId)

    // Prepare the data for insertion with SRS defaults
    const entriesToInsert = words.map((word) => ({
      set_id: setId,
      user_id: user.id,
      term: word.term.trim(),
      definition: word.definition.trim(),
      next_review_date: new Date().toISOString(),
      review_interval: SRS_CONFIG.INITIAL_INTERVAL_DAYS,
      mastery_level: SRS_CONFIG.MASTERY_LEVEL_MIN,
      example_sentence: null,
      image_url: null,
      last_reviewed_at: null,
    }))

    // Insert all words in a single query
    const { error: insertError } = await supabase
      .from('vocab_entries')
      .insert(entriesToInsert)

    if (insertError) {
      return {
        success: false,
        message: `Database error: ${insertError.message}`,
      }
    }

    // Invalidate the cache for the detail page to show the new words
    revalidatePath(`/student/vocab/${setId}`)
    return { success: true, count: entriesToInsert.length }
  } catch (error) {
    return createErrorResponse(error)
  }
}

// SRS Algorithm Functions
export async function updateVocabWithSRS(
  entryId: number,
  isCorrect: boolean
): Promise<VocabActionResponse> {
  try {
    const { user, supabase } = await verifyVocabEntryOwner(entryId)

    // Get current entry data
    const { data: entry, error: fetchError } = await supabase
      .from('vocab_entries')
      .select('mastery_level, review_interval')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !entry) {
      return { success: false, message: 'Entry not found.' }
    }

    // Calculate new values based on SRS algorithm
    const { newMasteryLevel, newReviewInterval, nextReviewDate } =
      calculateSRSValues(entry.mastery_level, entry.review_interval, isCorrect)

    // Update the entry with new SRS values
    const { error: updateError } = await supabase
      .from('vocab_entries')
      .update({
        mastery_level: newMasteryLevel,
        review_interval: newReviewInterval,
        next_review_date: nextReviewDate.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateError) {
      return {
        success: false,
        message: `Update failed: ${updateError.message}`,
      }
    }

    return { success: true }
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Calculate new SRS values based on current state and correctness
 */
function calculateSRSValues(
  currentMasteryLevel: number,
  currentReviewInterval: number,
  isCorrect: boolean
): {
  newMasteryLevel: number
  newReviewInterval: number
  nextReviewDate: Date
} {
  let newMasteryLevel: number
  let newReviewInterval: number
  let nextReviewDate: Date

  if (isCorrect) {
    // Correct answer: increase mastery level and double the review interval
    newMasteryLevel = Math.min(
      SRS_CONFIG.MASTERY_LEVEL_MAX,
      currentMasteryLevel + 1
    )
    newReviewInterval = Math.min(
      SRS_CONFIG.MAX_REVIEW_INTERVAL_DAYS,
      currentReviewInterval * SRS_CONFIG.INTERVAL_MULTIPLIER
    )
    nextReviewDate = new Date(
      Date.now() + newReviewInterval * 24 * 60 * 60 * 1000
    )
  } else {
    // Incorrect answer: decrease mastery level and reset review interval
    newMasteryLevel = Math.max(
      SRS_CONFIG.MASTERY_LEVEL_MIN,
      currentMasteryLevel - 1
    )
    newReviewInterval = SRS_CONFIG.INCORRECT_RESET_INTERVAL_DAYS
    nextReviewDate = new Date(
      Date.now() + SRS_CONFIG.INCORRECT_NEXT_REVIEW_MINUTES * 60 * 1000
    )
  }

  return { newMasteryLevel, newReviewInterval, nextReviewDate }
}

export async function getWordsForSmartReview(
  userId: string
): Promise<SmartReviewResponse> {
  try {
    const { supabase } = await verifyAuthenticated()

    const { data: words, error } = await supabase
      .from('vocab_entries')
      .select(
        `
        id,
        set_id,
        user_id,
        term,
        definition,
        example_sentence,
        image_url,
        mastery_level,
        last_reviewed_at,
        next_review_date,
        review_interval,
        created_at,
        vocab_sets!inner(title)
      `
      )
      .eq('user_id', userId)
      .lte('next_review_date', new Date().toISOString())
      .order('next_review_date', { ascending: true })

    if (error) {
      return { success: false, message: error.message, words: [] }
    }

    return {
      success: true,
      words: (words || []) as unknown as SmartReviewWord[],
    }
  } catch (error) {
    return createErrorResponse(error)
  }
}

export async function getSmartReviewCount(
  userId: string
): Promise<SmartReviewCountResponse> {
  try {
    const { supabase } = await verifyAuthenticated()

    const { count, error } = await supabase
      .from('vocab_entries')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .lte('next_review_date', new Date().toISOString())

    if (error) {
      return { success: false, count: 0 }
    }

    return { success: true, count: count || 0 }
  } catch (error) {
    return { success: false, count: 0 }
  }
}

export async function createVocabSet(
  formData: FormData
): Promise<CreateSetResponse> {
  try {
    const { user, supabase } = await verifyAuthenticated()

    const title = formData.get('title') as string
    const description = formData.get('description') as string

    if (!title?.trim()) {
      return { success: false, message: 'Title is required.' }
    }

    const { data, error } = await supabase
      .from('vocab_sets')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      return {
        success: false,
        message: `Failed to create vocab set: ${error.message}`,
      }
    }

    revalidatePath('/student/vocab')
    return { success: true, setId: data.id }
  } catch (error) {
    return createErrorResponse(error)
  }
}

export async function addVocabEntry(
  formData: FormData
): Promise<VocabActionResponse> {
  try {
    const setId = parseInt(formData.get('setId') as string)
    const term = formData.get('term') as string
    const definition = formData.get('definition') as string
    const exampleSentence = formData.get('exampleSentence') as string
    const imageUrl = formData.get('imageUrl') as string

    if (!term?.trim() || !definition?.trim()) {
      return { success: false, message: 'Term and definition are required.' }
    }

    const { user, supabase } = await verifyVocabSetOwner(setId)

    const { error } = await supabase.from('vocab_entries').insert({
      set_id: setId,
      user_id: user.id,
      term: term.trim(),
      definition: definition.trim(),
      example_sentence: exampleSentence?.trim() || null,
      image_url: imageUrl?.trim() || null,
      mastery_level: SRS_CONFIG.MASTERY_LEVEL_MIN,
      next_review_date: new Date().toISOString(),
      review_interval: SRS_CONFIG.INITIAL_INTERVAL_DAYS,
      last_reviewed_at: null,
    })

    if (error) {
      return {
        success: false,
        message: `Failed to add entry: ${error.message}`,
      }
    }

    revalidatePath(`/student/vocab/${setId}`)
    return { success: true }
  } catch (error) {
    return createErrorResponse(error)
  }
}

export async function processQuizResults(
  results: QuizResult[]
): Promise<ProcessQuizResultsResponse> {
  try {
    const { user, supabase } = await verifyAuthenticated()

    if (!results || results.length === 0) {
      return { success: false, message: 'No results to process.' }
    }

    // Map the JS array to a format the PostgreSQL function understands
    const formattedResults = results.map(r => ({
      entry_id: r.entryId,
      was_correct: r.wasCorrect,
    }))

    // Use the bulk update function for much better performance
    const { error } = await supabase.rpc('bulk_update_vocab_progress', {
      p_user_id: user.id,
      results: formattedResults
    })

    if (error) {
      return {
        success: false,
        message: `Failed to process results: ${error.message}`,
      }
    }

    // Revalidate relevant paths
    const setIds = [...new Set(results.map((r) => r.setId))]
    setIds.forEach((setId) => {
      revalidatePath(`/student/vocab/${setId}`)
    })
    revalidatePath('/student/vocab')

    return {
      success: true,
      processedCount: results.length,
      totalCount: results.length,
    }
  } catch (error) {
    return createErrorResponse(error)
  }
}
