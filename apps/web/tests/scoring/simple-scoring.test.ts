import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { checkAnswer, normalizeCorrectAnswers } from '../../lib/answer-checker'
import { ScoringService } from '../../lib/scoring-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Simple Scoring System Test', () => {
  it('should validate basic answer checking works', () => {
    // Test single answers
    expect(checkAnswer('A', 'A')).toBe(true)
    expect(checkAnswer('a', 'A')).toBe(true)
    expect(checkAnswer('B', 'A')).toBe(false)

    // Test multiple answers
    expect(checkAnswer('192', ['192', '192.0', '192.00'])).toBe(true)
    expect(checkAnswer('192.0', ['192', '192.0', '192.00'])).toBe(true)
    expect(checkAnswer('193', ['192', '192.0', '192.00'])).toBe(false)

    console.log('✅ Basic answer checking works!')
  })

  it('should normalize various answer formats', () => {
    // Test string input
    expect(normalizeCorrectAnswers('A')).toEqual(['A'])

    // Test JSON string array
    expect(normalizeCorrectAnswers('["A", "B"]')).toEqual(['A', 'B'])

    // Test regular array
    expect(normalizeCorrectAnswers(['A', 'B'])).toEqual(['A', 'B'])

    // Test malformed input
    expect(normalizeCorrectAnswers(null)).toEqual([])

    console.log('✅ Answer normalization works!')
  })

  it('should connect to database and fetch exam data', async () => {
    try {
      const { data: exams, error } = await supabase
        .from('exams')
        .select('id, title')
        .limit(3)

      if (error) throw error

      expect(exams).toBeDefined()
      expect(Array.isArray(exams)).toBe(true)

      if (exams && exams.length > 0) {
        console.log(`✅ Database connection works! Found ${exams.length} exams:`)
        exams.forEach(exam => console.log(`  - ${exam.title}`))
      } else {
        console.log('⚠️ Database connected but no exams found')
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      throw error
    }
  }, 10000)

  it('should fetch questions from a real exam', async () => {
    try {
      // Get first exam
      const { data: exams } = await supabase
        .from('exams')
        .select('id, title')
        .limit(1)

      if (!exams || exams.length === 0) {
        console.log('⚠️ No exams found, skipping question test')
        return
      }

      const exam = exams[0]
      console.log(`🔍 Testing exam: ${exam.title}`)

      // Get questions for this exam
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, correct_answer, module_type, points')
        .eq('exam_id', exam.id)
        .limit(5)

      if (error) throw error

      expect(questions).toBeDefined()

      if (questions && questions.length > 0) {
        console.log(`✅ Found ${questions.length} questions`)

        // Test answer normalization on real data
        questions.forEach((q, i) => {
          const normalized = normalizeCorrectAnswers(q.correct_answer)
          console.log(`  Question ${i+1}: ${normalized.length} correct answer(s)`)

          if (normalized.length > 1) {
            console.log(`    🔢 Multiple answers: ${normalized.join(', ')}`)
          }
        })
      } else {
        console.log('⚠️ No questions found for this exam')
      }

    } catch (error) {
      console.error('❌ Question fetching failed:', error)
      throw error
    }
  }, 15000)

  it('should test real scoring calculation', async () => {
    try {
      // Find a completed test attempt
      const { data: attempts, error } = await supabase
        .from('test_attempts')
        .select('id, exam_id, total_score, final_scores')
        .eq('status', 'completed')
        .not('total_score', 'is', null)
        .limit(1)

      if (error) throw error

      if (!attempts || attempts.length === 0) {
        console.log('⚠️ No completed attempts found, skipping scoring test')
        return
      }

      const attempt = attempts[0]
      console.log(`🔄 Testing scoring for attempt: ${attempt.id}`)
      console.log(`📊 Original score: ${attempt.total_score}`)

      // Recalculate scores
      const recalculatedScores = await ScoringService.calculateFinalScores(
        attempt.id,
        true // Use service role
      )

      console.log(`🔄 Recalculated score: ${recalculatedScores.overall}`)
      console.log(`📈 Difference: ${Math.abs(attempt.total_score - recalculatedScores.overall)}`)

      // Should be reasonably close (allow for small differences due to rounding)
      const scoreDifference = Math.abs(attempt.total_score - recalculatedScores.overall)
      expect(scoreDifference).toBeLessThan(20)

      console.log('✅ Scoring calculation works!')

    } catch (error) {
      console.error('❌ Scoring test failed:', error)
      throw error
    }
  }, 30000)
})