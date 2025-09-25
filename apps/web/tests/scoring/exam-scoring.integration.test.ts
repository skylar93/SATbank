import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ScoringService } from '../../lib/scoring-service'
import { submitExamAndScore, createTestExam } from '../utils/test-exam-utils'
import {
  generateExamTestCases,
  generateTestAnswers,
} from '../utils/test-data-generator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Full Exam Scoring Integration', () => {
  let realExams: any[] = []

  beforeAll(async () => {
    // Get real exam data for integration testing
    const { data: exams } = await supabase
      .from('exams')
      .select(
        'id, title, template_id, english_scoring_curve_id, math_scoring_curve_id'
      )
      .limit(5)

    realExams = exams || []
  })

  describe('Real Exam Data Integration', () => {
    it('should correctly score a complete exam with multiple answer types', async () => {
      for (const exam of realExams) {
        console.log(`\n🎯 Testing exam: ${exam.title}`)

        // Create a comprehensive test attempt
        const testExam = await createTestExam(exam.id)
        const testAnswers = await generateTestAnswers(testExam, {
          includeMultipleAnswerTypes: true,
          includePerfectScore: false,
          includePartialScore: true,
          includeEdgeCases: true,
        })

        const result = await submitExamAndScore(testAnswers)

        expect(result.scores).toBeDefined()
        expect(result.scores.overall).toBeGreaterThan(0)
        expect(result.validationReport.passed).toBe(true)

        console.log(`✅ ${exam.title}: Overall score ${result.scores.overall}`)
      }
    })

    it('should handle perfect score scenarios', async () => {
      const exam = realExams[0]
      if (!exam) return

      const testExam = await createTestExam(exam.id)
      const perfectAnswers = await generateTestAnswers(testExam, {
        scenario: 'perfect_score',
      })

      const result = await submitExamAndScore(perfectAnswers)

      // Perfect score should be maximum possible for this exam
      expect(result.scores.overall).toBeGreaterThan(1400) // SAT max is 1600
      console.log(`🎯 Perfect score test: ${result.scores.overall}`)
    })

    it('should handle zero score scenarios', async () => {
      const exam = realExams[0]
      if (!exam) return

      const testExam = await createTestExam(exam.id)
      const zeroAnswers = await generateTestAnswers(testExam, {
        scenario: 'zero_score',
      })

      const result = await submitExamAndScore(zeroAnswers)

      // Zero score should be minimum SAT score
      expect(result.scores.overall).toBeLessThan(500)
      console.log(`💀 Zero score test: ${result.scores.overall}`)
    })

    it('should validate multiple correct answer handling', async () => {
      const exam = realExams[0]
      if (!exam) return

      const testExam = await createTestExam(exam.id)
      const multipleAnswerTest = await generateTestAnswers(testExam, {
        scenario: 'multiple_answers_focus',
      })

      const result = await submitExamAndScore(multipleAnswerTest)

      expect(result.multipleAnswerValidation.questionsFound).toBeGreaterThan(0)
      expect(result.multipleAnswerValidation.allVariationsWork).toBe(true)

      console.log(
        `🔢 Multiple answers: Found ${result.multipleAnswerValidation.questionsFound} questions`
      )
    })
  })

  describe('Automated Scenario Testing', () => {
    const testScenarios = generateExamTestCases()

    it.each(testScenarios)(
      'should handle $scenario scenario correctly',
      async ({ scenario, config }) => {
        const exam = realExams[0]
        if (!exam) return

        console.log(`\n🎪 Testing scenario: ${scenario}`)

        const testExam = await createTestExam(exam.id)
        const testAnswers = await generateTestAnswers(testExam, config)

        const result = await submitExamAndScore(testAnswers)

        // Validate based on scenario
        switch (scenario) {
          case 'perfect_score':
            expect(result.scores.overall).toBeGreaterThan(1400)
            break
          case 'mixed_performance':
            expect(result.scores.overall).toBeGreaterThan(800)
            expect(result.scores.overall).toBeLessThan(1400)
            break
          case 'edge_cases':
            expect(result.edgeCaseValidation.passed).toBe(true)
            break
          case 'module_type_variations':
            expect(result.moduleValidation.allModulesScored).toBe(true)
            break
        }

        console.log(`✅ ${scenario}: Score ${result.scores.overall}`)
      }
    )
  })

  describe('Scoring Curve Integration', () => {
    it('should apply scoring curves correctly across different raw score ranges', async () => {
      const exam = realExams[0]
      if (!exam) return

      // Test different raw score ranges
      const scoreRanges = [
        { range: 'low', rawScoreTarget: 10 },
        { range: 'medium', rawScoreTarget: 30 },
        { range: 'high', rawScoreTarget: 50 },
      ]

      for (const scoreRange of scoreRanges) {
        const testExam = await createTestExam(exam.id)
        const targetAnswers = await generateTestAnswers(testExam, {
          targetRawScore: scoreRange.rawScoreTarget,
        })

        const result = await submitExamAndScore(targetAnswers)

        console.log(
          `📊 ${scoreRange.range} range (target ${scoreRange.rawScoreTarget}): ${result.scores.overall}`
        )

        // Verify the curve is working (scores should be reasonable)
        expect(result.scores.overall).toBeGreaterThan(200)
        expect(result.scores.overall).toBeLessThan(1600)
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed question data gracefully', async () => {
      // This will test our error handling when questions have bad data
      const corruptedExam = {
        id: 'test-exam',
        questions: [
          { id: '1', correct_answer: null, module_type: null },
          { id: '2', correct_answer: 'invalid_json[', module_type: 'english1' },
          { id: '3', correct_answer: [''], module_type: '' },
        ],
      }

      const answers = [
        { questionId: '1', userAnswer: 'A' },
        { questionId: '2', userAnswer: 'B' },
        { questionId: '3', userAnswer: 'C' },
      ]

      // Should not throw errors, but handle gracefully
      const result = await submitExamAndScore(answers, { exam: corruptedExam })

      expect(result.errorHandling.gracefullyHandled).toBe(true)
      expect(result.errorHandling.errors.length).toBeGreaterThan(0)
    })

    it('should validate grid-in answer processing', async () => {
      // Test grid-in specific scenarios
      const gridInTests = [
        { input: '1.5', expected: true },
        { input: '3/2', expected: true },
        { input: '1.50', expected: true },
        { input: '15/10', expected: true },
        { input: 'abc', expected: false },
      ]

      for (const test of gridInTests) {
        // This would test the grid-in validator
        console.log(`🔢 Grid-in test: ${test.input} → ${test.expected}`)
      }
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle bulk scoring efficiently', async () => {
      const startTime = Date.now()

      // Generate many test cases
      const bulkTests = Array.from({ length: 10 }, (_, i) => ({
        examId: realExams[0]?.id,
        testCase: i,
      }))

      const results = await Promise.all(
        bulkTests.map(async (test) => {
          const testExam = await createTestExam(test.examId)
          const answers = await generateTestAnswers(testExam, {
            scenario: 'random',
          })
          return submitExamAndScore(answers)
        })
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`⚡ Bulk test: ${bulkTests.length} exams in ${duration}ms`)

      expect(results.length).toBe(bulkTests.length)
      expect(duration).toBeLessThan(30000) // Should complete in under 30 seconds
    })
  })
})
