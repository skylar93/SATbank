import { createClient } from '@supabase/supabase-js'
import { ScoringService } from '../../lib/scoring-service'
import { checkAnswer, normalizeCorrectAnswers } from '../../lib/answer-checker'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ExamTestResult {
  examId: string
  examTitle: string
  success: boolean
  summary: {
    totalQuestions: number
    questionsWithMultipleAnswers: number
    avgProcessingTime: number
  }
  issues: {
    critical: string[]
    warnings: string[]
  }
  detailedResults?: any[]
}

export interface BatchTestResult {
  timestamp: string
  totalExamstested: number
  successRate: number
  totalIssues: number
  results: ExamTestResult[]
  summary: {
    totalQuestions: number
    totalMultipleAnswers: number
    averageProcessingTime: number
  }
}

/**
 * Run comprehensive tests on all exams
 */
export async function runFullExamValidation(): Promise<BatchTestResult> {
  const startTime = Date.now()
  console.log('🚀 Starting comprehensive exam validation...')

  // Get all exams
  const { data: exams } = await supabase
    .from('exams')
    .select('id, title')
    .order('title')

  if (!exams || exams.length === 0) {
    throw new Error('No exams found to test')
  }

  console.log(`📚 Found ${exams.length} exams to validate`)

  const results: ExamTestResult[] = []
  let totalQuestions = 0
  let totalMultipleAnswers = 0
  let totalProcessingTime = 0

  // Test each exam
  for (const exam of exams) {
    const examResult = await testSingleExam(exam.id, exam.title)
    results.push(examResult)

    totalQuestions += examResult.summary.totalQuestions
    totalMultipleAnswers += examResult.summary.questionsWithMultipleAnswers
    totalProcessingTime += examResult.summary.avgProcessingTime

    console.log(`${examResult.success ? '✅' : '❌'} ${exam.title}: ${examResult.issues.critical.length + examResult.issues.warnings.length} issues`)
  }

  const successfulTests = results.filter(r => r.success).length
  const totalIssues = results.reduce((sum, r) => sum + r.issues.critical.length + r.issues.warnings.length, 0)

  const batchResult: BatchTestResult = {
    timestamp: new Date().toISOString(),
    totalExamsTests: exams.length,
    successRate: (successfulTests / exams.length) * 100,
    totalIssues,
    results,
    summary: {
      totalQuestions,
      totalMultipleAnswers,
      averageProcessingTime: totalProcessingTime / exams.length
    }
  }

  const endTime = Date.now()
  console.log(`\n🎯 BATCH TEST COMPLETED in ${(endTime - startTime) / 1000}s`)
  console.log(`📊 Success Rate: ${batchResult.successRate.toFixed(1)}%`)
  console.log(`📝 Total Questions: ${totalQuestions}`)
  console.log(`🔢 Multiple Answer Questions: ${totalMultipleAnswers}`)
  console.log(`❌ Total Issues: ${totalIssues}`)

  return batchResult
}

/**
 * Test a single exam comprehensively
 */
export async function testSingleExam(examId: string, examTitle: string): Promise<ExamTestResult> {
  const startTime = Date.now()

  const result: ExamTestResult = {
    examId,
    examTitle,
    success: false,
    summary: {
      totalQuestions: 0,
      questionsWithMultipleAnswers: 0,
      avgProcessingTime: 0
    },
    issues: {
      critical: [],
      warnings: []
    },
    detailedResults: []
  }

  try {
    // Test 1: Validate exam structure and configuration
    await validateExamStructure(examId, result)

    // Test 2: Validate all questions and answers
    await validateExamQuestions(examId, result)

    // Test 3: Test scoring system
    await validateExamScoring(examId, result)

    // Test 4: Simulate exam attempt and scoring
    await simulateExamAttempt(examId, result)

    // Determine success
    result.success = result.issues.critical.length === 0
    result.summary.avgProcessingTime = Date.now() - startTime

  } catch (error) {
    result.issues.critical.push(`Unexpected error: ${error.message}`)
  }

  return result
}

/**
 * Validate exam structure and configuration
 */
async function validateExamStructure(examId: string, result: ExamTestResult) {
  const { data: exam, error } = await supabase
    .from('exams')
    .select(`
      id,
      title,
      template_id,
      english_scoring_curve_id,
      math_scoring_curve_id,
      exam_templates (
        id,
        name,
        scoring_groups
      )
    `)
    .eq('id', examId)
    .single()

  if (error || !exam) {
    result.issues.critical.push(`Failed to fetch exam: ${error?.message}`)
    return
  }

  // Check scoring curves
  if (!exam.english_scoring_curve_id && !exam.math_scoring_curve_id) {
    result.issues.warnings.push('No scoring curves assigned')
  }

  // Check template
  if (!exam.template_id) {
    result.issues.warnings.push('No exam template assigned (will use fallback)')
  } else if (!exam.exam_templates) {
    result.issues.critical.push(`Template ${exam.template_id} not found`)
  }
}

/**
 * Validate all questions in the exam
 */
async function validateExamQuestions(examId: string, result: ExamTestResult) {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, correct_answer, module_type, points, question_text')
    .eq('exam_id', examId)

  if (error || !questions) {
    result.issues.critical.push(`Failed to fetch questions: ${error?.message}`)
    return
  }

  result.summary.totalQuestions = questions.length

  if (questions.length === 0) {
    result.issues.critical.push('Exam has no questions')
    return
  }

  // Validate each question
  for (const question of questions) {
    await validateSingleQuestion(question, result)
  }
}

/**
 * Validate a single question
 */
async function validateSingleQuestion(question: any, result: ExamTestResult) {
  try {
    // Test correct_answer parsing
    const normalized = normalizeCorrectAnswers(question.correct_answer)

    if (normalized.length === 0) {
      result.issues.critical.push(`Question ${question.id}: No valid correct answers`)
      return
    }

    if (normalized.length > 1) {
      result.summary.questionsWithMultipleAnswers++
    }

    // Test answer variations
    for (const correctAnswer of normalized) {
      // Test case insensitive
      if (!checkAnswer(correctAnswer.toLowerCase(), normalized)) {
        result.issues.critical.push(`Question ${question.id}: Case sensitivity issue with "${correctAnswer}"`)
      }

      // Test whitespace tolerance
      if (!checkAnswer(` ${correctAnswer} `, normalized)) {
        result.issues.critical.push(`Question ${question.id}: Whitespace handling issue with "${correctAnswer}"`)
      }
    }

    // Validate module type
    if (!question.module_type || typeof question.module_type !== 'string' || question.module_type.trim() === '') {
      result.issues.critical.push(`Question ${question.id}: Invalid module_type`)
    }

    // Validate points
    if (!question.points || question.points < 0) {
      result.issues.warnings.push(`Question ${question.id}: Invalid points value (${question.points})`)
    }

  } catch (error) {
    result.issues.critical.push(`Question ${question.id}: ${error.message}`)
  }
}

/**
 * Validate exam scoring system
 */
async function validateExamScoring(examId: string, result: ExamTestResult) {
  try {
    // Get exam details
    const { data: exam } = await supabase
      .from('exams')
      .select('english_scoring_curve_id, math_scoring_curve_id')
      .eq('id', examId)
      .single()

    if (!exam) return

    // Validate scoring curves exist and are properly formatted
    const curveIds = [exam.english_scoring_curve_id, exam.math_scoring_curve_id].filter(Boolean)

    for (const curveId of curveIds) {
      const { data: curve } = await supabase
        .from('scoring_curves')
        .select('curve_data')
        .eq('id', curveId)
        .single()

      if (!curve || !curve.curve_data) {
        result.issues.critical.push(`Scoring curve ${curveId} not found or invalid`)
        continue
      }

      // Validate curve data structure
      const curveData = curve.curve_data
      if (!Array.isArray(curveData) || curveData.length === 0) {
        result.issues.critical.push(`Scoring curve ${curveId} has invalid data structure`)
        continue
      }

      // Check curve data points
      for (const point of curveData) {
        if (typeof point.raw !== 'number' || typeof point.lower !== 'number' || typeof point.upper !== 'number') {
          result.issues.critical.push(`Scoring curve ${curveId} has invalid data point: ${JSON.stringify(point)}`)
        }
        if (point.lower > point.upper) {
          result.issues.critical.push(`Scoring curve ${curveId} has invalid range: ${point.lower} > ${point.upper}`)
        }
      }
    }

  } catch (error) {
    result.issues.critical.push(`Scoring validation failed: ${error.message}`)
  }
}

/**
 * Simulate an exam attempt to test full scoring flow
 */
async function simulateExamAttempt(examId: string, result: ExamTestResult) {
  try {
    // Get questions for this exam
    const { data: questions } = await supabase
      .from('questions')
      .select('id, correct_answer')
      .eq('exam_id', examId)
      .limit(10) // Test with first 10 questions for speed

    if (!questions || questions.length === 0) return

    // Create a test user (or use existing test user)
    const testUserId = 'test-user-scoring-validation'

    // Create a test attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('test_attempts')
      .insert({
        user_id: testUserId,
        exam_id: examId,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      result.issues.warnings.push(`Could not create test attempt: ${attemptError?.message}`)
      return
    }

    // Submit correct answers for all questions
    const userAnswers = []
    for (const question of questions) {
      const correctAnswers = normalizeCorrectAnswers(question.correct_answer)
      if (correctAnswers.length > 0) {
        userAnswers.push({
          attempt_id: attempt.id,
          question_id: question.id,
          user_answer: correctAnswers[0], // Use first correct answer
          is_correct: true,
          time_spent_seconds: 30
        })
      }
    }

    if (userAnswers.length > 0) {
      const { error: answersError } = await supabase
        .from('user_answers')
        .insert(userAnswers)

      if (answersError) {
        result.issues.warnings.push(`Could not insert test answers: ${answersError.message}`)
      } else {
        // Test scoring calculation
        try {
          const finalScores = await ScoringService.calculateFinalScores(attempt.id, true)

          if (!finalScores || typeof finalScores.overall !== 'number') {
            result.issues.critical.push('Scoring calculation returned invalid results')
          } else if (finalScores.overall < 0) {
            result.issues.critical.push(`Scoring calculation returned negative score: ${finalScores.overall}`)
          }

        } catch (scoringError) {
          result.issues.critical.push(`Scoring calculation failed: ${scoringError.message}`)
        }
      }
    }

    // Cleanup test data
    await supabase.from('user_answers').delete().eq('attempt_id', attempt.id)
    await supabase.from('test_attempts').delete().eq('id', attempt.id)

  } catch (error) {
    result.issues.warnings.push(`Simulation test failed: ${error.message}`)
  }
}

/**
 * Generate a detailed HTML report
 */
export function generateTestReport(batchResult: BatchTestResult): string {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Exam Scoring Validation Report</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .success { color: #28a745; }
            .warning { color: #ffc107; }
            .error { color: #dc3545; }
            .exam-result { border: 1px solid #dee2e6; margin: 20px 0; padding: 15px; border-radius: 5px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
            .summary-card { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
            ul { margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Exam Scoring Validation Report</h1>
            <p><strong>Generated:</strong> ${new Date(batchResult.timestamp).toLocaleString()}</p>
            <p><strong>Success Rate:</strong> <span class="${batchResult.successRate > 95 ? 'success' : batchResult.successRate > 80 ? 'warning' : 'error'}">${batchResult.successRate.toFixed(1)}%</span></p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>${batchResult.totalExamsTest}</h3>
                <p>Exams Tested</p>
            </div>
            <div class="summary-card">
                <h3>${batchResult.summary.totalQuestions}</h3>
                <p>Total Questions</p>
            </div>
            <div class="summary-card">
                <h3>${batchResult.summary.totalMultipleAnswers}</h3>
                <p>Multiple Answer Questions</p>
            </div>
            <div class="summary-card">
                <h3>${batchResult.totalIssues}</h3>
                <p>Total Issues</p>
            </div>
        </div>

        <h2>📋 Exam Results</h2>
        ${batchResult.results.map(exam => `
            <div class="exam-result">
                <h3>${exam.success ? '✅' : '❌'} ${exam.examTitle}</h3>
                <p><strong>Questions:</strong> ${exam.summary.totalQuestions} (${exam.summary.questionsWithMultipleAnswers} with multiple answers)</p>
                <p><strong>Processing Time:</strong> ${exam.summary.avgProcessingTime}ms</p>

                ${exam.issues.critical.length > 0 ? `
                    <h4 class="error">🚨 Critical Issues (${exam.issues.critical.length})</h4>
                    <ul>${exam.issues.critical.map(issue => `<li class="error">${issue}</li>`).join('')}</ul>
                ` : ''}

                ${exam.issues.warnings.length > 0 ? `
                    <h4 class="warning">⚠️ Warnings (${exam.issues.warnings.length})</h4>
                    <ul>${exam.issues.warnings.map(issue => `<li class="warning">${issue}</li>`).join('')}</ul>
                ` : ''}

                ${exam.success ? '<p class="success">✅ All tests passed!</p>' : ''}
            </div>
        `).join('')}

        <div style="margin-top: 40px; padding: 20px; background: #e9ecef; border-radius: 5px;">
            <h3>💡 Recommendations</h3>
            <ul>
                <li>Fix all critical issues before deploying changes</li>
                <li>Review warnings for potential improvements</li>
                <li>Run this validation after any scoring logic changes</li>
                <li>Consider adding more edge case tests for questions with multiple answers</li>
            </ul>
        </div>
    </body>
    </html>
  `
  return html
}