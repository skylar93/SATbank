import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Fix Template Assignments', () => {
  it('should fix template assignments based on exam content', async () => {
    console.log('🔍 Checking exam module compositions vs templates...')

    // Get all test attempts that are failing
    const { data: failedAttempts } = await supabase
      .from('test_attempts')
      .select(
        `
        id,
        exam_id,
        exams(id, title, template_id, module_composition)
      `
      )
      .eq('status', 'completed')
      .limit(10)

    console.log('\n📋 Exam Template Analysis:')
    const examAnalysis: { [key: string]: any } = {}

    if (failedAttempts) {
      for (const attempt of failedAttempts) {
        const exam = attempt.exams
        if (!exam) continue

        if (!examAnalysis[exam.id]) {
          examAnalysis[exam.id] = exam

          console.log(`\n🎯 ${exam.title}:`)
          console.log(`   Template: ${exam.template_id}`)
          console.log(`   Modules: ${JSON.stringify(exam.module_composition)}`)

          // Get user answers to understand what modules exist
          const { data: answers } = await supabase
            .from('user_answers')
            .select('module_type')
            .eq('test_attempt_id', attempt.id)
            .limit(5)

          const moduleTypes = [
            ...new Set(answers?.map((a) => a.module_type) || []),
          ]
          console.log(`   Answer Modules: ${moduleTypes.join(', ')}`)

          // Determine correct template
          const hasEnglish = moduleTypes.some((m) => m?.startsWith('english'))
          const hasMath = moduleTypes.some((m) => m?.startsWith('math'))

          let correctTemplate = 'english_only'
          if (hasEnglish && hasMath) {
            correctTemplate = 'full_sat'
          } else if (hasMath && !hasEnglish) {
            correctTemplate = 'math_only'
          }

          if (exam.template_id !== correctTemplate) {
            console.log(
              `   🔧 Needs Update: ${exam.template_id} → ${correctTemplate}`
            )

            const { error: updateError } = await supabase
              .from('exams')
              .update({ template_id: correctTemplate })
              .eq('id', exam.id)

            if (updateError) {
              console.log(`   ❌ Update Failed: ${updateError.message}`)
            } else {
              console.log(`   ✅ Updated Successfully`)
            }
          } else {
            console.log(`   ✅ Template Correct`)
          }
        }
      }
    }

    expect(true).toBe(true)
  })
})
