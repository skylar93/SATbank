// Client-side version for admin actions
'use client'

import { createClient } from '@/lib/supabase/client'

export async function updateAnswerVisibilityClient(
  examId: string,
  visibility: 'hidden' | 'immediate' | 'scheduled',
  releaseDate?: string | null
) {
  const supabase = createClient()
  
  // Check auth client-side
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  // Check admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.')
  }

  // Update logic
  let updateData: any
  if (visibility === 'hidden') {
    updateData = { answers_visible: false, answers_visible_after: null }
  } else if (visibility === 'immediate') {
    updateData = { answers_visible: true, answers_visible_after: null }
  } else if (visibility === 'scheduled' && releaseDate) {
    updateData = { answers_visible: false, answers_visible_after: releaseDate }
  } else {
    throw new Error('Invalid visibility option.')
  }

  const { error } = await supabase
    .from('test_attempts')
    .update(updateData)
    .eq('exam_id', examId)

  if (error) throw error
  
  // Refresh the page
  window.location.reload()
  return { success: true }
}