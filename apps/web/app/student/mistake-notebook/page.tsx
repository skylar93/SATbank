import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { MistakeNotebookClient } from '@/components/mistake-notebook/MistakeNotebookClient'
import type { MistakeWithQuestion } from '@/lib/types'

async function getMistakes(userId: string): Promise<MistakeWithQuestion[]> {
  const { data: mistakes, error } = await supabase
    .from('mistake_bank')
    .select(`
      id,
      user_id,
      question_id,
      status,
      first_mistaken_at,
      last_reviewed_at,
      questions!question_id (
        id,
        exam_id,
        module_type,
        question_number,
        question_type,
        difficulty_level,
        question_text,
        question_image_url,
        options,
        correct_answer,
        correct_answers,
        explanation,
        points,
        topic_tags,
        table_data,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('first_mistaken_at', { ascending: false })

  if (error) {
    console.error('Error fetching mistakes:', error)
    return []
  }

  return mistakes as unknown as MistakeWithQuestion[]
}

export default async function MistakeNotebookPage() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const mistakes = await getMistakes(user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Mistake Notebook</h1>
          <p className="mt-2 text-gray-600">
            Review your mistakes and create custom practice quizzes to improve your weak areas.
          </p>
        </div>

        <MistakeNotebookClient mistakes={mistakes} />
      </div>
    </div>
  )
}