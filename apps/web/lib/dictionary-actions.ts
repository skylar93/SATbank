'use server'

import { revalidatePath } from 'next/cache'
import { verifyAuthenticated } from '@/lib/auth-utils.server'
import { createErrorResponse } from '@/lib/error-handler'
import { SRS_CONFIG } from '@/types/vocab.types'

interface WordDefinitionResult {
  success: boolean
  message?: string
  definition?: string
  example?: string | null
}

interface AutoAddVocabResult {
  success: boolean
  message: string
  entryId?: number
}

/**
 * Fetch word definition and example from Free Dictionary API
 */
export async function fetchWordDefinition(
  word: string
): Promise<WordDefinitionResult> {
  try {
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return {
        success: false,
        message: 'Please provide a valid word to look up.',
      }
    }

    const cleanWord = word.trim().toLowerCase()

    // Call the Free Dictionary API (no API key required)
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          message: `No definition found for "${word}". Please try a different word.`,
        }
      }
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        message: `No definition data available for "${word}".`,
      }
    }

    // Extract the first meaning and definition
    const firstEntry = data[0]
    const firstMeaning = firstEntry?.meanings?.[0]
    const firstDefinition = firstMeaning?.definitions?.[0]

    if (!firstDefinition?.definition) {
      return {
        success: false,
        message: `Definition not available for "${word}".`,
      }
    }

    return {
      success: true,
      definition: firstDefinition.definition,
      example: firstDefinition.example || null,
    }
  } catch (error) {
    console.error('Error fetching word definition:', error)
    return {
      success: false,
      message:
        'Unable to fetch definition. Please check your internet connection and try again.',
    }
  }
}

/**
 * Automatically add a word to vocabulary with fetched definition
 * Creates or finds appropriate vocab set based on exam context
 */
export async function autoAddToVocab(
  word: string,
  examTitle?: string | null,
  examId?: string | null
): Promise<AutoAddVocabResult> {
  try {
    const { user, supabase } = await verifyAuthenticated()

    // Step 1: Fetch word definition
    const definitionResult = await fetchWordDefinition(word)
    if (!definitionResult.success) {
      return {
        success: false,
        message: definitionResult.message || 'Failed to fetch word definition.',
      }
    }

    // Step 2: Determine or create vocab set
    let vocabSetId: number
    const vocabSetTitle = examTitle || 'My Vocabulary'

    // Try to find existing vocab set with the same title
    const { data: existingSet, error: findError } = await supabase
      .from('vocab_sets')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('title', vocabSetTitle)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 = no rows found
      throw findError
    }

    if (existingSet) {
      // Use existing set
      vocabSetId = existingSet.id
    } else {
      // Create new vocab set
      const { data: newSet, error: createError } = await supabase
        .from('vocab_sets')
        .insert({
          user_id: user.id,
          title: vocabSetTitle,
          description: examTitle
            ? `Vocabulary from ${examTitle}`
            : 'Personal vocabulary collection',
        })
        .select('id')
        .single()

      if (createError) {
        throw createError
      }

      vocabSetId = newSet.id
    }

    // Step 3: Check if word already exists in this set
    const { data: existingEntry, error: duplicateError } = await supabase
      .from('vocab_entries')
      .select('id, term')
      .eq('set_id', vocabSetId)
      .eq('user_id', user.id)
      .eq('term', word.trim())
      .single()

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      throw duplicateError
    }

    if (existingEntry) {
      return {
        success: false,
        message: `"${word}" is already in your vocabulary set.`,
      }
    }

    // Step 4: Add word to vocab set
    const { data: newEntry, error: insertError } = await supabase
      .from('vocab_entries')
      .insert({
        set_id: vocabSetId,
        user_id: user.id,
        term: word.trim(),
        definition: definitionResult.definition!,
        example_sentence: definitionResult.example,
        mastery_level: SRS_CONFIG.MASTERY_LEVEL_MIN,
        next_review_date: new Date().toISOString(),
        review_interval: SRS_CONFIG.INITIAL_INTERVAL_DAYS,
        last_reviewed_at: null,
      })
      .select('id')
      .single()

    if (insertError) {
      throw insertError
    }

    // Revalidate vocab pages
    revalidatePath('/student/vocab')
    revalidatePath(`/student/vocab/${vocabSetId}`)

    return {
      success: true,
      message: `Successfully added "${word}" to your vocabulary!`,
      entryId: newEntry.id,
    }
  } catch (error) {
    console.error('Error auto-adding word to vocab:', error)
    return createErrorResponse(error)
  }
}
