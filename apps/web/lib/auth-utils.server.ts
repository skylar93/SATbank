'use server'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { type Database } from '../../../packages/database-types/src/index'

export interface AuthResult {
  user: {
    id: string
    email?: string
  }
  supabase: ReturnType<typeof createServerComponentClient<Database>>
}

/**
 * Verifies that the current user is authenticated and has admin role
 * @throws Error if not authenticated or not an admin
 * @returns Object containing user and supabase client
 */
export async function verifyAdmin(): Promise<AuthResult> {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Authentication required.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error(`Failed to fetch user profile: ${profileError.message}`)
  }

  if (profile?.role !== 'admin') {
    throw new Error('Permission denied: Admin role required.')
  }

  return {
    user: { id: user.id, email: user.email },
    supabase,
  }
}

/**
 * Verifies that the current user is authenticated
 * @throws Error if not authenticated
 * @returns Object containing user and supabase client
 */
export async function verifyAuthenticated(): Promise<AuthResult> {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Authentication required.')
  }

  return {
    user: { id: user.id, email: user.email },
    supabase,
  }
}

/**
 * Verifies that the current user owns the specified vocabulary set
 * @param setId - The ID of the vocabulary set to check ownership for
 * @throws Error if not authenticated or not the owner
 * @returns Object containing user and supabase client
 */
export async function verifyVocabSetOwner(setId: number): Promise<AuthResult> {
  const { user, supabase } = await verifyAuthenticated()

  const { data: setOwner, error } = await supabase
    .from('vocab_sets')
    .select('user_id')
    .eq('id', setId)
    .single()

  if (error) {
    throw new Error(
      `Failed to verify vocabulary set ownership: ${error.message}`
    )
  }

  if (!setOwner || setOwner.user_id !== user.id) {
    throw new Error('Permission denied: You do not own this vocabulary set.')
  }

  return { user, supabase }
}

/**
 * Verifies that the current user owns the specified vocabulary entry
 * @param entryId - The ID of the vocabulary entry to check ownership for
 * @throws Error if not authenticated or not the owner
 * @returns Object containing user and supabase client
 */
export async function verifyVocabEntryOwner(
  entryId: number
): Promise<AuthResult> {
  const { user, supabase } = await verifyAuthenticated()

  const { data: entry, error } = await supabase
    .from('vocab_entries')
    .select('user_id')
    .eq('id', entryId)
    .single()

  if (error) {
    throw new Error(
      `Failed to verify vocabulary entry ownership: ${error.message}`
    )
  }

  if (!entry || entry.user_id !== user.id) {
    throw new Error('Permission denied: You do not own this vocabulary entry.')
  }

  return { user, supabase }
}

/**
 * Generic helper to handle server action errors consistently
 * @param error - The error that occurred
 * @returns Standardized error response
 */
export function handleServerActionError(error: unknown): {
  success: false
  message: string
} {
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred'
  return { success: false, message }
}
