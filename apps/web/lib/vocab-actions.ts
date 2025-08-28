'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Temporary local database type definition
interface Database {
  public: {
    Tables: {
      vocab_sets: {
        Row: any
        Insert: any
        Update: any
      }
      vocab_entries: {
        Row: any
        Insert: any
        Update: any
      }
    }
  }
}

interface NewWord {
  term: string
  definition: string
}

export async function addWordsInBulk(setId: number, words: NewWord[]) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Authentication required." };
  }
  if (!words || words.length === 0) {
    return { success: false, message: "No words to add." };
  }

  // Verify the user owns the vocab set
  const { data: setOwner, error: ownerError } = await supabase
    .from('vocab_sets')
    .select('user_id')
    .eq('id', setId)
    .single();

  if (ownerError || setOwner?.user_id !== user.id) {
    return { success: false, message: "Permission denied." };
  }

  // Prepare the data for insertion with SRS defaults
  const entriesToInsert = words.map(word => ({
    set_id: setId,
    user_id: user.id,
    term: word.term,
    definition: word.definition,
    next_review_date: new Date().toISOString(),
    review_interval: 1,
    mastery_level: 0
  }));

  // Insert all words in a single query
  const { error: insertError } = await supabase.from('vocab_entries').insert(entriesToInsert);

  if (insertError) {
    return { success: false, message: `Database error: ${insertError.message}` };
  }

  // Invalidate the cache for the detail page to show the new words
  revalidatePath(`/student/vocab/${setId}`);
  return { success: true, count: entriesToInsert.length };
}

// SRS Algorithm Functions
export async function updateVocabWithSRS(entryId: number, isCorrect: boolean) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Authentication required." };
  }

  // Get current entry data
  const { data: entry, error: fetchError } = await supabase
    .from('vocab_entries')
    .select('mastery_level, review_interval')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !entry) {
    return { success: false, message: "Entry not found." };
  }

  // Calculate new values based on SRS algorithm
  let newMasteryLevel: number;
  let newReviewInterval: number;
  let nextReviewDate: Date;

  if (isCorrect) {
    // Correct answer: increase mastery level and double the review interval
    newMasteryLevel = Math.min(5, entry.mastery_level + 1);
    newReviewInterval = Math.min(180, entry.review_interval * 2); // Cap at 6 months
    nextReviewDate = new Date(Date.now() + newReviewInterval * 24 * 60 * 60 * 1000);
  } else {
    // Incorrect answer: decrease mastery level and reset review interval
    newMasteryLevel = Math.max(0, entry.mastery_level - 1);
    newReviewInterval = 1;
    nextReviewDate = new Date(Date.now() + 10 * 60 * 1000); // Review again in 10 minutes
  }

  // Update the entry with new SRS values
  const { error: updateError } = await supabase
    .from('vocab_entries')
    .update({
      mastery_level: newMasteryLevel,
      review_interval: newReviewInterval,
      next_review_date: nextReviewDate.toISOString(),
      last_reviewed_at: new Date().toISOString()
    })
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (updateError) {
    return { success: false, message: `Update failed: ${updateError.message}` };
  }

  return { success: true };
}

export async function getWordsForSmartReview(userId: string) {
  const supabase = createServerComponentClient<Database>({ cookies });
  
  const { data: words, error } = await supabase
    .from('vocab_entries')
    .select(`
      id,
      term,
      definition,
      example_sentence,
      mastery_level,
      next_review_date,
      review_interval,
      set_id,
      vocab_sets!inner(title)
    `)
    .eq('user_id', userId)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date', { ascending: true });

  if (error) {
    return { success: false, message: error.message, words: [] };
  }

  return { success: true, words: words || [] };
}

export async function getSmartReviewCount(userId: string) {
  const supabase = createServerComponentClient<Database>({ cookies });
  
  const { count, error } = await supabase
    .from('vocab_entries')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .lte('next_review_date', new Date().toISOString());

  if (error) {
    return { success: false, count: 0 };
  }

  return { success: true, count: count || 0 };
}