import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Template Assignment Check', () => {
  it('should check exam template assignments', async () => {
    console.log('🔍 Checking exam template assignments...')

    const { data: exams } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .limit(10)

    console.log('\n📋 Exam Template Status:')
    const examsWithoutTemplates: string[] = []

    exams?.forEach((exam) => {
      const status = exam.template_id ? '✅' : '❌'
      console.log(
        `${status} ${exam.title}: ${exam.template_id || 'NO TEMPLATE'}`
      )
      if (!exam.template_id) {
        examsWithoutTemplates.push(exam.id)
      }
    })

    const { data: templates } = await supabase
      .from('scoring_templates')
      .select('id, name')

    console.log('\n📋 Available Templates:')
    templates?.forEach((template) => {
      console.log(`  - ${template.name} (id: ${template.id})`)
    })

    // Check the specific problematic exam
    const { data: problemExam } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (problemExam) {
      console.log(`\n🎯 Problem Exam: ${problemExam.title}`)
      console.log(`   Template ID: ${problemExam.template_id || 'NONE'}`)
    }

    console.log(
      `\n📊 Summary: ${examsWithoutTemplates.length} exams without templates`
    )

    // This test just provides info, always passes
    expect(true).toBe(true)
  })
})
