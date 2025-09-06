'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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

/**
 * Verifies the current user is an authenticated admin within a Server Action.
 * Throws an error if not authorized.
 * @returns The authenticated user object and a server-side Supabase client.
 */
async function verifyAdminAuth() {
  console.log('🔍 verifyAdminAuth: Starting authentication check...')
  
  try {
    const supabase = await createClient()
    console.log('✅ verifyAdminAuth: Created Supabase server client')

    // Get the user directly - the server client should handle session automatically
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('📋 verifyAdminAuth: Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      errorMessage: userError?.message
    })

    if (userError || !user) {
      console.log('❌ verifyAdminAuth: No user found or auth error')
      throw new Error('로그인이 필요합니다.')
    }

    console.log('👤 verifyAdminAuth: User authenticated, checking admin role...')

    // Verify the user's role from the database.
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('👮 verifyAdminAuth: Role check result:', {
      hasProfile: !!profile,
      role: profile?.role,
      errorMessage: profileError?.message
    })

    if (profileError || profile?.role !== 'admin') {
      console.log('❌ verifyAdminAuth: Admin role verification failed')
      throw new Error('관리자 권한이 필요합니다.')
    }

    console.log('🎉 verifyAdminAuth: Authentication and authorization successful!')
    return { user, supabase }
    
  } catch (error) {
    console.log('💥 verifyAdminAuth: Exception caught:', error)
    throw error
  }
}

export async function updateExamCurve(
  examId: string,
  curveType: 'english' | 'math',
  curveId: number | null
) {
  const { supabase } = await verifyAdminAuth()

  const updateData =
    curveType === 'english'
      ? { english_scoring_curve_id: curveId }
      : { math_scoring_curve_id: curveId }

  const { error } = await supabase
    .from('exams')
    .update(updateData)
    .eq('id', examId)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/exams') // Crucial: This tells Next.js to refresh the data on this page
  return { success: true }
}

export async function updateAnswerVisibilityForAttempt(
  examId: string, // We operate on the exam level for bulk updates
  visibility: 'hidden' | 'immediate' | 'scheduled',
  releaseDate?: string | null
) {
  const { supabase } = await verifyAdminAuth()

  let updateData: any
  if (visibility === 'hidden') {
    updateData = { answers_visible: false, answers_visible_after: null }
  } else if (visibility === 'immediate') {
    updateData = { answers_visible: true, answers_visible_after: null }
  } else if (visibility === 'scheduled' && releaseDate) {
    updateData = { answers_visible: false, answers_visible_after: releaseDate }
  } else {
    return { success: false, message: 'Invalid visibility option.' }
  }

  const { error } = await supabase
    .from('test_attempts')
    .update(updateData)
    .eq('exam_id', examId)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/exams')
  return { success: true }
}

export async function createTestAttempt(attempt: any) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.log('🚨 No user found in createTestAttempt')
    throw new Error('Unauthorized: No user found.')
  }
  
  console.log('✅ User found in createTestAttempt:', user.id)

  const { data, error } = await supabase
    .from('test_attempts')
    .insert({
      ...attempt,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createExam(formData: FormData) {
  const { supabase } = await verifyAdminAuth()

  const title = formData.get('title') as string
  const description = formData.get('description') as string

  // Validate the input
  if (!title || title.trim().length === 0) {
    return { success: false, message: 'Exam title is required.' }
  }

  // Insert the new exam into the database
  const { data: newExam, error } = await supabase
    .from('exams')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, message: `Database error: ${error.message}` }
  }

  // Invalidate the cache for the exam list page
  revalidatePath('/admin/exams')

  // Return the new exam data, including its ID
  return { success: true, newExam }
}

export async function addQuestionToExam(examId: string) {
  const { supabase } = await verifyAdminAuth()

  try {
    // For simplicity, we'll add to the last module or a default one.
    // A more advanced implementation could let the user choose.
    const defaultModule = 'english1'

    // 1. Find the highest existing question number in that module
    const { data: lastQuestion, error: numError } = await supabase
      .from('questions')
      .select('question_number')
      .eq('exam_id', examId)
      .eq('module_type', defaultModule)
      .order('question_number', { ascending: false })
      .limit(1)
      .single()

    if (numError && numError.code !== 'PGRST116') {
      // Ignore 'no rows found' error
      throw numError
    }
    const nextQuestionNumber = (lastQuestion?.question_number || 0) + 1

    // 2. Create the new question with default content
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        exam_id: examId,
        question_number: nextQuestionNumber,
        module_type: defaultModule,
        question_text:
          '### New Question\n\nThis is a new placeholder question. Click "Edit" to modify its content.',
        question_type: 'multiple_choice',
        difficulty_level: 'medium',
        options: {
          A: 'Option A',
          B: 'Option B',
          C: 'Option C',
          D: 'Option D',
        },
        correct_answer: 'A',
        topic_tags: ['new-question'],
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // 3. Revalidate paths to refresh data on relevant pages
    revalidatePath(`/admin/exams/${examId}/preview`)
    revalidatePath('/admin/questions')

    return { success: true, newQuestion }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to add question: ${error.message}`,
    }
  }
}


export async function createExamFromModules(
  data: {
    title: string
    description: string
    templateId: string
    moduleAssignments: Record<string, string>
  }
) {
  const { supabase } = await verifyAdminAuth()

  try {
    // 1. Create the parent exam record
    const { data: newExam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: data.title,
        description: data.description,
        template_id: data.templateId,
        module_composition: data.moduleAssignments,
      })
      .select()
      .single()

    if (examError) {
      throw examError
    }

    const newExamId = newExam.id

    // 2. Populate the exam_questions junction table
    console.log('🔗 Processing module assignments:', data.moduleAssignments)
    for (const [moduleType, sourceExamId] of Object.entries(data.moduleAssignments)) {
      console.log(`📝 Processing ${moduleType} from exam ${sourceExamId}`)
      
      // Get all questions from the source module
      const { data: sourceQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, question_number')
        .eq('exam_id', sourceExamId)
        .eq('module_type', moduleType)
        .order('question_number')

      console.log(`📊 Found ${sourceQuestions?.length || 0} questions for ${moduleType}`)

      if (questionsError) {
        console.log(`❌ Error fetching questions for ${moduleType}:`, questionsError)
        throw questionsError
      }

      if (!sourceQuestions || sourceQuestions.length === 0) {
        console.log(`⚠️ No questions found for ${moduleType} in exam ${sourceExamId}`)
        continue
      }

      // Insert records into exam_questions junction table
      const examQuestionRecords = sourceQuestions.map(question => ({
        exam_id: newExamId,
        question_id: question.id,
        question_number: question.question_number,
        module_type: moduleType,
      }))

      console.log(`💾 Inserting ${examQuestionRecords.length} junction records for ${moduleType}`)
      
      const { error: junctionError } = await supabase
        .from('exam_questions')
        .insert(examQuestionRecords)

      if (junctionError) {
        console.log(`❌ Junction table insert error for ${moduleType}:`, junctionError)
        throw junctionError
      }
      
      console.log(`✅ Successfully inserted ${examQuestionRecords.length} records for ${moduleType}`)
    }

    // 3. Revalidate the admin exams page
    revalidatePath('/admin/exams')

    return { success: true, examId: newExamId }
  } catch (error: any) {
    console.error('Error creating exam from modules:', error)
    return {
      success: false,
      error: `Failed to create exam: ${error.message}`,
    }
  }
}
