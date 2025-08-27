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

  // Prepare the data for insertion
  const entriesToInsert = words.map(word => ({
    set_id: setId,
    user_id: user.id,
    term: word.term,
    definition: word.definition,
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