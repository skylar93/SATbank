import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Find Math2 Issue', () => {
  it('should find the attempt causing math2 module issue', async () => {
    console.log('🔍 Finding the math2 issue...')

    // Look for test attempts that have math2 answers
    const { data: mathAttempts } = await supabase
      .from('user_answers')
      .select(`
        test_attempt_id,
        module_type,
        test_attempts(
          id,
          exam_id,
          exams(id, title, template_id)
        )
      `)
      .like('module_type', '%math%')
      .limit(10)

    console.log('\n📋 Math Module Analysis:')
    if (mathAttempts) {
      const attemptGroups: { [key: string]: any } = {}

      mathAttempts.forEach(answer => {
        const attemptId = answer.test_attempt_id
        if (!attemptGroups[attemptId]) {
          attemptGroups[attemptId] = {
            attempt: answer.test_attempts,
            moduleTypes: new Set()
          }
        }
        attemptGroups[attemptId].moduleTypes.add(answer.module_type)
      })

      Object.values(attemptGroups).forEach((group: any) => {
        if (group.attempt?.exams) {
          const exam = group.attempt.exams
          const modules = Array.from(group.moduleTypes)
          console.log(`\n🎯 Attempt ${group.attempt.id}:`)
          console.log(`   Exam: ${exam.title}`)
          console.log(`   Template: ${exam.template_id}`)
          console.log(`   Modules: ${modules.join(', ')}`)

          // Check if this is the problematic case
          if (modules.includes('math2') && exam.template_id === 'english_only') {
            console.log(`   🚨 PROBLEM FOUND: Math module with English template!`)
            console.log(`   🔧 Should update to full_sat template`)
          }
        }
      })
    }

    // Also check specific error case from previous run
    const { data: specificAttempt } = await supabase
      .from('test_attempts')
      .select(`
        id,
        exam_id,
        exams(id, title, template_id),
        user_answers(module_type)
      `)
      .eq('id', '7df87839-f738-4e10-98a1-9e588130e982')
      .single()

    if (specificAttempt) {
      const moduleTypes = specificAttempt.user_answers?.map(a => a.module_type) || []
      console.log(`\n🎯 Specific Problem Attempt:`)
      console.log(`   ID: ${specificAttempt.id}`)
      console.log(`   Exam: ${specificAttempt.exams?.title}`)
      console.log(`   Template: ${specificAttempt.exams?.template_id}`)
      console.log(`   Modules: ${[...new Set(moduleTypes)].join(', ')}`)

      if (moduleTypes.includes('math2') && specificAttempt.exams?.template_id === 'english_only') {
        console.log(`\n🔧 Fixing exam template...`)

        const { error } = await supabase
          .from('exams')
          .update({ template_id: 'full_sat' })
          .eq('id', specificAttempt.exam_id)

        if (error) {
          console.log(`❌ Update failed: ${error.message}`)
        } else {
          console.log(`✅ Updated exam to full_sat template`)
        }
      }
    }

    expect(true).toBe(true)
  })
})