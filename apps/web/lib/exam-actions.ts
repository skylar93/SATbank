'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
// Temporary local database type definition
interface Database {
  public: {
    Tables: {
      exams: {
        Row: any
        Insert: any
        Update: any
      }
      test_attempts: {
        Row: any
        Insert: any
        Update: any
      }
      user_profiles: {
        Row: any
        Insert: any
        Update: any
      }
    }
  }
}

// Helper function for admin check
async function checkAdminAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized: No user found.');
  }
  
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required.');
  }
  
  return user;
}

export async function updateExamCurve(
  examId: string,
  curveType: 'english' | 'math',
  curveId: number | null
) {
  const supabase = createServerComponentClient<Database>({ cookies });
  await checkAdminAuth(supabase);

  const updateData = curveType === 'english'
    ? { english_scoring_curve_id: curveId }
    : { math_scoring_curve_id: curveId };

  const { error } = await supabase.from('exams').update(updateData).eq('id', examId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/admin/exams'); // Crucial: This tells Next.js to refresh the data on this page
  return { success: true };
}

export async function updateAnswerVisibilityForAttempt(
  examId: string, // We operate on the exam level for bulk updates
  visibility: 'hidden' | 'immediate' | 'scheduled',
  releaseDate?: string | null
) {
  const supabase = createServerComponentClient<Database>({ cookies });
  await checkAdminAuth(supabase);
  
  let updateData: any;
  if (visibility === 'hidden') {
    updateData = { answers_visible: false, answers_visible_after: null };
  } else if (visibility === 'immediate') {
    updateData = { answers_visible: true, answers_visible_after: null };
  } else if (visibility === 'scheduled' && releaseDate) {
    updateData = { answers_visible: false, answers_visible_after: releaseDate };
  } else {
    return { success: false, message: "Invalid visibility option." };
  }

  const { error } = await supabase.from('test_attempts').update(updateData).eq('exam_id', examId);
  
  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/admin/exams');
  return { success: true };
}

export async function createTestAttempt(attempt: any) {
  const supabase = createServerComponentClient<Database>({ cookies });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized: No user found.');
  }

  const { data, error } = await supabase
    .from('test_attempts')
    .insert({
      ...attempt,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}