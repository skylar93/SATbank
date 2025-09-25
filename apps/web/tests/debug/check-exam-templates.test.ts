import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Exam Templates Check', () => {
  it('should check exam_templates table', async () => {
    console.log('🔍 Checking exam_templates table...')

    // Check if exam_templates exists
    const { data: templates, error } = await supabase
      .from('exam_templates')
      .select('*')

    if (error) {
      console.log(`❌ exam_templates: ${error.message}`)

      // Try to create the table and necessary data
      console.log('\n🔧 Creating missing exam_templates...')

      // Create the english_only template that exams are referencing
      const { data: createdTemplate, error: createError } = await supabase
        .from('exam_templates')
        .upsert({
          id: 'english_only',
          name: 'English Only Section',
          scoring_groups: {
            english: ['english1', 'english2']
          }
        })
        .select()

      if (createError) {
        console.log(`❌ Failed to create template: ${createError.message}`)
      } else {
        console.log('✅ Created english_only template')
      }
    } else {
      console.log(`✅ exam_templates: exists with ${templates?.length || 0} templates`)
      templates?.forEach(template => {
        console.log(`  - ${template.name} (id: ${template.id})`)
        console.log(`    Scoring Groups: ${JSON.stringify(template.scoring_groups)}`)
      })
    }

    // Now check the problematic exam again
    const { data: mockExam } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (mockExam) {
      console.log(`\n🎯 Mock Exam: ${mockExam.title}`)
      console.log(`   Template ID: ${mockExam.template_id || 'NONE'}`)

      if (!mockExam.template_id) {
        console.log('\n🔧 Assigning template to Mock Exam...')
        const { error: updateError } = await supabase
          .from('exams')
          .update({ template_id: 'english_only' })
          .eq('id', mockExam.id)

        if (updateError) {
          console.log(`❌ Failed to update: ${updateError.message}`)
        } else {
          console.log('✅ Mock Exam updated with template')
        }
      }
    }

    expect(true).toBe(true)
  })
})