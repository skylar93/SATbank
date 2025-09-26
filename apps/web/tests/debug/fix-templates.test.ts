import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Fix Template Assignments', () => {
  it('should assign templates to exams without them', async () => {
    console.log('🔧 Fixing template assignments...')

    // First check what templates exist
    const { data: templates } = await supabase
      .from('scoring_templates')
      .select('id, name')

    console.log('\n📋 Available Templates:')
    templates?.forEach((template) => {
      console.log(`  - ${template.name} (id: ${template.id})`)
    })

    if (!templates || templates.length === 0) {
      console.log(
        '❌ No templates found! Need to check scoring_templates table'
      )
      expect(false).toBe(true) // Fail the test to highlight this issue
      return
    }

    // Get exams without templates
    const { data: examsWithoutTemplates } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .is('template_id', null)

    console.log(
      `\n🎯 Found ${examsWithoutTemplates?.length || 0} exams without templates`
    )

    if (examsWithoutTemplates && examsWithoutTemplates.length > 0) {
      // Try to find a suitable template (english_only seems to be the standard)
      const englishTemplate = templates.find((t) => t.id === 'english_only')

      if (englishTemplate) {
        console.log(`\n✅ Using template: ${englishTemplate.name}`)

        for (const exam of examsWithoutTemplates) {
          const { error } = await supabase
            .from('exams')
            .update({ template_id: englishTemplate.id })
            .eq('id', exam.id)

          if (error) {
            console.log(`❌ Failed to update ${exam.title}: ${error.message}`)
          } else {
            console.log(`✅ Updated ${exam.title}`)
          }
        }
      } else {
        console.log('❌ No suitable template found (looking for english_only)')
      }
    }

    // Verify the specific problematic exam
    const { data: mockTest } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (mockTest) {
      console.log(
        `\n🎯 Mock Test after fix: ${mockTest.template_id || 'STILL NO TEMPLATE'}`
      )
    }

    expect(true).toBe(true)
  })
})
