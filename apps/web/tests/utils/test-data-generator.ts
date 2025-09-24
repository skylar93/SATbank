import { createClient } from '@supabase/supabase-js'
import { checkAnswer, normalizeCorrectAnswers } from '../../lib/answer-checker'
import { validateGridInAnswer } from '../../lib/grid-in-validator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TestScenarioConfig {
  scenario?: string
  includeMultipleAnswerTypes?: boolean
  includePerfectScore?: boolean
  includePartialScore?: boolean
  includeEdgeCases?: boolean
  targetRawScore?: number
  moduleTypeFocus?: string[]
  answerVariationTesting?: boolean
}

export interface TestCase {
  scenario: string
  config: TestScenarioConfig
  description: string
  expectedBehavior: string
}

export interface GeneratedAnswer {
  questionId: string
  userAnswer: string
  isIntentionallyCorrect: boolean
  answerVariation?: string
  testingEdgeCase?: boolean
}

export interface TestExamData {
  examId: string
  questions: Array<{
    id: string
    correct_answer: any
    module_type: string
    points: number
    question_type: string
  }>
  totalQuestions: number
  moduleBreakdown: Record<string, number>
}

/**
 * Generate comprehensive test cases covering all scoring scenarios
 */
export function generateExamTestCases(): TestCase[] {
  return [
    {
      scenario: 'perfect_score',
      config: {
        scenario: 'perfect_score',
        includeMultipleAnswerTypes: true
      },
      description: 'All questions answered correctly with various input formats',
      expectedBehavior: 'Maximum possible score for the exam'
    },
    {
      scenario: 'zero_score',
      config: {
        scenario: 'zero_score'
      },
      description: 'All questions answered incorrectly',
      expectedBehavior: 'Minimum SAT scores (200 per section)'
    },
    {
      scenario: 'mixed_performance',
      config: {
        scenario: 'mixed_performance',
        targetRawScore: 30
      },
      description: 'Realistic mixed performance across modules',
      expectedBehavior: 'Balanced scores across english and math sections'
    },
    {
      scenario: 'multiple_answers_focus',
      config: {
        scenario: 'multiple_answers_focus',
        includeMultipleAnswerTypes: true,
        answerVariationTesting: true
      },
      description: 'Focus on questions with multiple correct answers',
      expectedBehavior: 'All answer variations should be accepted'
    },
    {
      scenario: 'edge_cases',
      config: {
        scenario: 'edge_cases',
        includeEdgeCases: true
      },
      description: 'Test edge cases like whitespace, case sensitivity, number formats',
      expectedBehavior: 'Robust handling of input variations'
    },
    {
      scenario: 'module_type_variations',
      config: {
        scenario: 'module_type_variations',
        moduleTypeFocus: ['english1', 'english2', 'math1', 'math2']
      },
      description: 'Test scoring across different module types',
      expectedBehavior: 'Proper grouping and scoring by module type'
    },
    {
      scenario: 'grid_in_focus',
      config: {
        scenario: 'grid_in_focus',
        includeEdgeCases: true
      },
      description: 'Focus on grid-in questions with various number formats',
      expectedBehavior: 'Equivalent numerical answers should be accepted'
    },
    {
      scenario: 'partial_completion',
      config: {
        scenario: 'partial_completion'
      },
      description: 'Some questions left unanswered',
      expectedBehavior: 'Unanswered questions should be scored as incorrect'
    },
    {
      scenario: 'stress_test',
      config: {
        scenario: 'stress_test',
        includeMultipleAnswerTypes: true,
        includeEdgeCases: true
      },
      description: 'Combination of all challenging scenarios',
      expectedBehavior: 'System should handle complexity gracefully'
    },
    {
      scenario: 'random',
      config: {
        scenario: 'random'
      },
      description: 'Random realistic performance simulation',
      expectedBehavior: 'Scores should reflect random performance distribution'
    }
  ]
}

/**
 * Generate test answers based on exam data and configuration
 */
export async function generateTestAnswers(
  examData: TestExamData,
  config: TestScenarioConfig
): Promise<GeneratedAnswer[]> {
  const answers: GeneratedAnswer[] = []

  for (const question of examData.questions) {
    const answer = await generateAnswerForQuestion(question, config)
    answers.push(answer)
  }

  console.log(`📝 Generated ${answers.length} test answers for scenario: ${config.scenario}`)
  return answers
}

/**
 * Smart test data generation based on real SAT patterns
 */
export async function generateSmartTestData(examId?: string) {
  console.log('🧠 Analyzing SAT patterns for smart test generation...')

  // Analyze existing data patterns
  const patterns = await analyzeSATPatterns(examId)

  return {
    multipleChoicePatterns: patterns.multipleChoice,
    gridInPatterns: patterns.gridIn,
    commonErrors: patterns.commonErrors,
    difficultyDistribution: patterns.difficulty,
    moduleTypeDistribution: patterns.moduleTypes
  }
}

/**
 * Generate answer for a single question based on scenario
 */
async function generateAnswerForQuestion(
  question: any,
  config: TestScenarioConfig
): Promise<GeneratedAnswer> {
  const correctAnswers = normalizeCorrectAnswers(question.correct_answer)

  let userAnswer = ''
  let isIntentionallyCorrect = false
  let answerVariation = ''
  let testingEdgeCase = false

  switch (config.scenario) {
    case 'perfect_score':
      isIntentionallyCorrect = true
      userAnswer = await generateCorrectAnswer(correctAnswers, config)
      break

    case 'zero_score':
      isIntentionallyCorrect = false
      userAnswer = await generateIncorrectAnswer(correctAnswers, question)
      break

    case 'mixed_performance':
      // 70% correct answers for realistic mixed performance
      isIntentionallyCorrect = Math.random() < 0.7
      userAnswer = isIntentionallyCorrect
        ? await generateCorrectAnswer(correctAnswers, config)
        : await generateIncorrectAnswer(correctAnswers, question)
      break

    case 'multiple_answers_focus':
      if (correctAnswers.length > 1) {
        isIntentionallyCorrect = true
        const variation = await generateAnswerVariation(correctAnswers)
        userAnswer = variation.answer
        answerVariation = variation.type
      } else {
        isIntentionallyCorrect = Math.random() < 0.8
        userAnswer = isIntentionallyCorrect
          ? correctAnswers[0] || 'A'
          : await generateIncorrectAnswer(correctAnswers, question)
      }
      break

    case 'edge_cases':
      isIntentionallyCorrect = true
      const edgeCase = await generateEdgeCaseAnswer(correctAnswers, question)
      userAnswer = edgeCase.answer
      testingEdgeCase = true
      answerVariation = edgeCase.type
      break

    case 'grid_in_focus':
      if (isGridInQuestion(question)) {
        isIntentionallyCorrect = true
        const gridInVariation = await generateGridInVariation(correctAnswers[0])
        userAnswer = gridInVariation.answer
        answerVariation = gridInVariation.type
      } else {
        isIntentionallyCorrect = Math.random() < 0.8
        userAnswer = isIntentionallyCorrect
          ? correctAnswers[0] || 'A'
          : await generateIncorrectAnswer(correctAnswers, question)
      }
      break

    case 'partial_completion':
      // 20% chance of leaving blank
      if (Math.random() < 0.2) {
        userAnswer = ''
        isIntentionallyCorrect = false
      } else {
        isIntentionallyCorrect = Math.random() < 0.75
        userAnswer = isIntentionallyCorrect
          ? correctAnswers[0] || 'A'
          : await generateIncorrectAnswer(correctAnswers, question)
      }
      break

    case 'random':
      isIntentionallyCorrect = Math.random() < 0.65 // Realistic SAT performance
      userAnswer = isIntentionallyCorrect
        ? await generateCorrectAnswer(correctAnswers, config)
        : await generateIncorrectAnswer(correctAnswers, question)
      break

    default:
      // Target specific raw score
      if (config.targetRawScore) {
        const correctnessRate = Math.min(config.targetRawScore / examData.totalQuestions, 0.95)
        isIntentionallyCorrect = Math.random() < correctnessRate
      } else {
        isIntentionallyCorrect = Math.random() < 0.7
      }

      userAnswer = isIntentionallyCorrect
        ? await generateCorrectAnswer(correctAnswers, config)
        : await generateIncorrectAnswer(correctAnswers, question)
  }

  return {
    questionId: question.id,
    userAnswer,
    isIntentionallyCorrect,
    answerVariation,
    testingEdgeCase
  }
}

/**
 * Generate a correct answer with possible variations
 */
async function generateCorrectAnswer(correctAnswers: string[], config: TestScenarioConfig): Promise<string> {
  if (correctAnswers.length === 0) return 'A'

  const baseAnswer = correctAnswers[0]

  if (config.includeEdgeCases && Math.random() < 0.3) {
    // 30% chance to test variations when including edge cases
    return generateAnswerVariation(correctAnswers).then(v => v.answer)
  }

  return baseAnswer
}

/**
 * Generate an incorrect answer
 */
async function generateIncorrectAnswer(correctAnswers: string[], question: any): Promise<string> {
  const wrongOptions = ['A', 'B', 'C', 'D']

  // Filter out correct answers
  const availableWrong = wrongOptions.filter(opt =>
    !correctAnswers.some(correct =>
      correct.toLowerCase().trim() === opt.toLowerCase().trim()
    )
  )

  if (availableWrong.length > 0) {
    return availableWrong[Math.floor(Math.random() * availableWrong.length)]
  }

  // For grid-in questions, generate a wrong number
  if (isGridInQuestion(question)) {
    const correctNum = parseFloat(correctAnswers[0])
    if (!isNaN(correctNum)) {
      return String(correctNum + Math.floor(Math.random() * 10) + 1)
    }
  }

  return 'WRONG_ANSWER'
}

/**
 * Generate answer variations for testing
 */
async function generateAnswerVariation(correctAnswers: string[]): Promise<{answer: string, type: string}> {
  const baseAnswer = correctAnswers[Math.floor(Math.random() * correctAnswers.length)]

  const variations = [
    { answer: baseAnswer.toLowerCase(), type: 'lowercase' },
    { answer: baseAnswer.toUpperCase(), type: 'uppercase' },
    { answer: ` ${baseAnswer} `, type: 'whitespace' },
    { answer: baseAnswer.replace(/\s+/g, ''), type: 'no_spaces' },
    { answer: baseAnswer, type: 'original' }
  ]

  return variations[Math.floor(Math.random() * variations.length)]
}

/**
 * Generate edge case answers for testing robustness
 */
async function generateEdgeCaseAnswer(correctAnswers: string[], question: any): Promise<{answer: string, type: string}> {
  const baseAnswer = correctAnswers[0] || 'A'

  const edgeCases = [
    { answer: `  ${baseAnswer}  `, type: 'extra_whitespace' },
    { answer: baseAnswer.toLowerCase(), type: 'case_insensitive' },
    { answer: baseAnswer + '\n', type: 'newline_suffix' },
    { answer: '\t' + baseAnswer, type: 'tab_prefix' }
  ]

  if (isGridInQuestion(question)) {
    const num = parseFloat(baseAnswer)
    if (!isNaN(num)) {
      edgeCases.push(
        { answer: num.toFixed(2), type: 'decimal_places' },
        { answer: String(num * 2) + '/' + '2', type: 'fraction_equivalent' },
        { answer: num === Math.floor(num) ? String(num) + '.0' : String(num), type: 'decimal_format' }
      )
    }
  }

  return edgeCases[Math.floor(Math.random() * edgeCases.length)]
}

/**
 * Generate grid-in answer variations
 */
async function generateGridInVariation(correctAnswer: string): Promise<{answer: string, type: string}> {
  const num = parseFloat(correctAnswer)

  if (isNaN(num)) {
    return { answer: correctAnswer, type: 'original' }
  }

  const variations = [
    { answer: String(num), type: 'standard' },
    { answer: num.toFixed(1), type: 'one_decimal' },
    { answer: num.toFixed(2), type: 'two_decimals' }
  ]

  // Add fraction equivalents for simple numbers
  if (num === Math.floor(num) && num <= 20) {
    variations.push({ answer: `${num}/1`, type: 'fraction_form' })
  }

  if (num === 0.5) {
    variations.push({ answer: '1/2', type: 'fraction_half' })
  }

  return variations[Math.floor(Math.random() * variations.length)]
}

/**
 * Analyze patterns in existing SAT data
 */
async function analyzeSATPatterns(examId?: string) {
  console.log('📊 Analyzing SAT question patterns...')

  const query = supabase
    .from('questions')
    .select('correct_answer, module_type, question_text, points')

  if (examId) {
    query.eq('exam_id', examId)
  }

  const { data: questions } = await query.limit(1000)

  if (!questions) return getDefaultPatterns()

  const analysis = {
    multipleChoice: analyzeMultipleChoicePatterns(questions),
    gridIn: analyzeGridInPatterns(questions),
    commonErrors: analyzeCommonErrors(questions),
    difficulty: analyzeDifficultyPatterns(questions),
    moduleTypes: analyzeModuleTypeDistribution(questions)
  }

  console.log('✅ Pattern analysis complete')
  return analysis
}

/**
 * Helper functions for pattern analysis
 */
function analyzeMultipleChoicePatterns(questions: any[]) {
  return {
    answerDistribution: ['A', 'B', 'C', 'D'].map(choice => ({
      choice,
      frequency: questions.filter(q =>
        normalizeCorrectAnswers(q.correct_answer)[0] === choice
      ).length
    })),
    multipleAnswerFrequency: questions.filter(q =>
      normalizeCorrectAnswers(q.correct_answer).length > 1
    ).length
  }
}

function analyzeGridInPatterns(questions: any[]) {
  const gridInQuestions = questions.filter(isGridInQuestion)

  return {
    numberTypes: {
      integers: gridInQuestions.filter(q => {
        const ans = normalizeCorrectAnswers(q.correct_answer)[0]
        return ans && !isNaN(Number(ans)) && Number.isInteger(Number(ans))
      }).length,
      decimals: gridInQuestions.filter(q => {
        const ans = normalizeCorrectAnswers(q.correct_answer)[0]
        return ans && !isNaN(Number(ans)) && !Number.isInteger(Number(ans))
      }).length,
      fractions: gridInQuestions.filter(q => {
        const ans = normalizeCorrectAnswers(q.correct_answer)[0]
        return ans && ans.includes('/')
      }).length
    },
    rangeDistribution: {
      small: gridInQuestions.filter(q => {
        const num = parseFloat(normalizeCorrectAnswers(q.correct_answer)[0])
        return !isNaN(num) && num >= 0 && num <= 10
      }).length,
      medium: gridInQuestions.filter(q => {
        const num = parseFloat(normalizeCorrectAnswers(q.correct_answer)[0])
        return !isNaN(num) && num > 10 && num <= 100
      }).length,
      large: gridInQuestions.filter(q => {
        const num = parseFloat(normalizeCorrectAnswers(q.correct_answer)[0])
        return !isNaN(num) && num > 100
      }).length
    }
  }
}

function analyzeCommonErrors(questions: any[]) {
  return {
    emptyAnswers: questions.filter(q => !normalizeCorrectAnswers(q.correct_answer)[0]).length,
    malformedJson: questions.filter(q => {
      try {
        JSON.parse(String(q.correct_answer))
        return false
      } catch {
        return typeof q.correct_answer === 'string' && q.correct_answer.includes('[')
      }
    }).length,
    caseIssues: questions.filter(q => {
      const answers = normalizeCorrectAnswers(q.correct_answer)
      return answers.some(ans => ans && ans !== ans.toLowerCase() && ans !== ans.toUpperCase())
    }).length
  }
}

function analyzeDifficultyPatterns(questions: any[]) {
  return {
    pointsDistribution: {
      1: questions.filter(q => q.points === 1).length,
      2: questions.filter(q => q.points === 2).length,
      3: questions.filter(q => q.points === 3).length,
      other: questions.filter(q => q.points > 3 || q.points < 1).length
    }
  }
}

function analyzeModuleTypeDistribution(questions: any[]) {
  const moduleTypes = [...new Set(questions.map(q => q.module_type))]

  return moduleTypes.reduce((acc, moduleType) => {
    acc[moduleType] = questions.filter(q => q.module_type === moduleType).length
    return acc
  }, {} as Record<string, number>)
}

function isGridInQuestion(question: any): boolean {
  const answers = normalizeCorrectAnswers(question.correct_answer)
  const firstAnswer = answers[0]

  if (!firstAnswer) return false

  // Check if it's a number or fraction
  return !isNaN(Number(firstAnswer)) || firstAnswer.includes('/')
}

function getDefaultPatterns() {
  return {
    multipleChoice: {
      answerDistribution: [
        { choice: 'A', frequency: 25 },
        { choice: 'B', frequency: 25 },
        { choice: 'C', frequency: 25 },
        { choice: 'D', frequency: 25 }
      ],
      multipleAnswerFrequency: 5
    },
    gridIn: {
      numberTypes: { integers: 60, decimals: 30, fractions: 10 },
      rangeDistribution: { small: 40, medium: 40, large: 20 }
    },
    commonErrors: { emptyAnswers: 0, malformedJson: 0, caseIssues: 5 },
    difficulty: { pointsDistribution: { 1: 80, 2: 15, 3: 5, other: 0 } },
    moduleTypes: { english1: 25, english2: 25, math1: 25, math2: 25 }
  }
}

// Export for exam data
declare global {
  var examData: TestExamData
}