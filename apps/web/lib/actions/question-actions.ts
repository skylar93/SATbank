'use server'

import { supabase } from '../supabase'
import { markdownToHtml, htmlToMarkdown, isEmptyHtml, isEmptyMarkdown } from '../content-converter'

interface UpdateQuestionData {
  id: string
  question_text?: string
  question_html?: string
  question_type: 'multiple_choice' | 'grid_in' | 'essay'
  options?: Record<string, string> | null
  correct_answer?: string
  correct_answers?: string[] | null
  explanation?: string | null
  table_data?: any
  content_format: 'markdown' | 'html'
  content: string  // The content from the active editor
}

export async function updateQuestionWithDualFormat(data: UpdateQuestionData) {
  console.log('🚀 updateQuestionWithDualFormat called with:', data)
  try {
    // Prepare the update data
    const updateData: any = {
      question_type: data.question_type,
      options: data.options,
      explanation: data.explanation,
      table_data: data.table_data,
      content_format: data.content_format,
    }

    // Handle correct answers based on question type
    if (data.question_type === 'grid_in') {
      const cleanAnswers = (data.correct_answers || [])
        .map((a: any) => String(a || '').trim())
        .filter((a: string) => a.length > 0)

      updateData.correct_answers = cleanAnswers.length > 0 ? cleanAnswers : ['']
      updateData.correct_answer = cleanAnswers[0] || ''
    } else {
      updateData.correct_answer = data.correct_answer
      updateData.correct_answers = null
    }

    // Handle dual content conversion based on content_format
    if (data.content_format === 'html') {
      // HTML is primary - save HTML and convert to markdown
      updateData.question_html = data.content
      updateData.question_text = htmlToMarkdown(data.content)
    } else {
      // Markdown is primary - save markdown and convert to HTML
      updateData.question_text = data.content
      updateData.question_html = markdownToHtml(data.content)
    }

    // Update the question in the database
    console.log('🔍 Attempting to update question with ID:', data.id)
    console.log('🔍 Update data:', updateData)
    
    const { data: result, error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', data.id)
      .select()
      
    console.log('🔍 Supabase result:', result)
    console.log('🔍 Supabase error:', error)

    if (error) {
      console.error('❌ Supabase error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw new Error(`Database error: ${error.message}`)
    }

    if (!result || result.length === 0) {
      throw new Error('No question found with the given ID')
    }

    return {
      success: true,
      data: result[0],
      error: null
    }
  } catch (error) {
    console.error('❌ Unexpected error updating question:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}