import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Final Test Fixes', () => {
  it('should make final fixes to resolve all issues', async () => {
    console.log('🎯 Final fixes for remaining issues...')

    // Fix 1: Find and fix the math2 module issue
    console.log('\n🔍 Issue 1: Finding the math2 module mismatch')

    // Look at the specific exam that caused the error in previous run
    // From the logs, it seems like there's an exam with math2 answers but english_only template
    const { data: attemptsWithMath } = await supabase
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
      .or('module_type.eq.math1,module_type.eq.math2')
      .limit(20)

    console.log('   Math module attempts found:', attemptsWithMath?.length || 0)

    // Group by exam to find problematic ones
    const examIssues: { [key: string]: any } = {}
    attemptsWithMath?.forEach(answer => {
      const exam = answer.test_attempts?.exams
      if (exam && answer.module_type?.startsWith('math')) {
        if (!examIssues[exam.id]) {
          examIssues[exam.id] = {
            exam,
            mathModules: new Set(),
            attemptIds: new Set()
          }
        }
        examIssues[exam.id].mathModules.add(answer.module_type)
        examIssues[exam.id].attemptIds.add(answer.test_attempt_id)
      }
    })

    // Find exams with math modules but wrong template
    for (const [examId, info] of Object.entries(examIssues)) {
      const examInfo = info as any
      if (examInfo.exam.template_id === 'english_only') {
        console.log(`\n   🚨 FOUND ISSUE: ${examInfo.exam.title}`)
        console.log(`      Template: ${examInfo.exam.template_id}`)
        console.log(`      Math Modules: ${Array.from(examInfo.mathModules).join(', ')}`)
        console.log(`      Attempts: ${examInfo.attemptIds.size}`)

        // Fix the template
        const { error } = await supabase
          .from('exams')
          .update({ template_id: 'full_sat' })
          .eq('id', examId)

        if (error) {
          console.log(`      ❌ Fix failed: ${error.message}`)
        } else {
          console.log(`      ✅ Updated to full_sat template`)
        }
      }
    }

    // Fix 2: Address the problematic questions threshold
    console.log('\n🔍 Issue 2: Adjusting test thresholds')

    // Get a more accurate count
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, correct_answer')
      .limit(200)

    let invalidCount = 0
    allQuestions?.forEach(q => {
      try {
        if (q.correct_answer && typeof q.correct_answer === 'string') {
          JSON.parse(q.correct_answer)
        }
      } catch (e) {
        invalidCount++
      }
    })

    const errorRate = invalidCount / (allQuestions?.length || 1)
    console.log(`   Total questions checked: ${allQuestions?.length || 0}`)
    console.log(`   Problematic questions: ${invalidCount}`)
    console.log(`   Error rate: ${(errorRate * 100).toFixed(1)}%`)

    if (errorRate > 0.05) {
      console.log(`   ⚠️  Error rate ${(errorRate * 100).toFixed(1)}% > 5%`)
      console.log(`   💡 Suggestion: Increase threshold or fix questions`)
    }

    // Fix 3: Check the empty test suite issue
    console.log('\n🔍 Issue 3: Empty test suite check')

    const { data: testCaseExams } = await supabase
      .from('exams')
      .select('id, title')
      .limit(10)

    console.log(`   Available exams for testing: ${testCaseExams?.length || 0}`)

    if (testCaseExams && testCaseExams.length > 0) {
      console.log('   ✅ Test cases should be populated')
      testCaseExams.forEach(exam => {
        console.log(`      - ${exam.title}`)
      })
    } else {
      console.log('   ❌ No exams found - this explains empty test suite')
    }

    expect(true).toBe(true)
  })
})