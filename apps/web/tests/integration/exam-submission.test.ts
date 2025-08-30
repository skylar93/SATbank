import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { useExamStore } from '@/store/exam-store'
import { supabase } from '@/lib/supabase'
import { setupTestData, cleanupTestData, signInAsTestUser, getCorrectAnswerForQuestion, type TestData } from './test-utils'

describe('Exam Submission Integration Test', () => {
  let testData: TestData

  beforeAll(async () => {
    // Setup test data: user, exam, and questions
    testData = await setupTestData()
    // Sign in as the test user
    await signInAsTestUser(testData.user.email)
  })

  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData(testData)
  })

  beforeEach(() => {
    // Reset the store state before each test
    useExamStore.getState().forceCleanup()
  })

  it('should complete a full exam flow and calculate final scores correctly', async () => {
    const store = useExamStore.getState()

    // 1. Initialize the exam
    await store.initializeExam(testData.exam.id, testData.user.id)
    
    // Verify exam initialization
    expect(store.exam).not.toBeNull()
    expect(store.exam?.id).toBe(testData.exam.id)
    expect(store.modules.length).toBeGreaterThan(0)
    expect(store.status).toBe('not_started')

    // 2. Start the exam
    await store.startExam()
    expect(store.status).toBe('in_progress')
    expect(store.attempt).not.toBeNull()

    const attemptId = store.attempt!.id

    // 3. Answer questions in each module
    for (let moduleIndex = 0; moduleIndex < store.modules.length; moduleIndex++) {
      const currentModule = store.modules[moduleIndex]
      console.log(`Testing module: ${currentModule.module} with ${currentModule.questions.length} questions`)

      // Answer all questions in the current module
      for (let questionIndex = 0; questionIndex < currentModule.questions.length; questionIndex++) {
        // Navigate to the specific question
        store.goToQuestion(questionIndex)
        
        const currentQuestion = store.getCurrentQuestion()
        expect(currentQuestion).not.toBeNull()
        
        // Get the correct answer for this question
        const correctAnswer = getCorrectAnswerForQuestion(currentQuestion!)
        
        // Set the answer
        store.setLocalAnswer(correctAnswer)
        
        // Verify answer was set
        expect(store.getCurrentAnswer()).toBe(correctAnswer)
      }

      // Move to next module or complete exam
      if (moduleIndex < store.modules.length - 1) {
        await store.nextModule()
        expect(store.currentModuleIndex).toBe(moduleIndex + 1)
      } else {
        // Last module - complete the exam
        await store.completeExam()
        expect(store.status).toBe('completed')
      }
    }

    // 4. Verify the exam was completed and scores calculated
    expect(store.finalScores).toBeDefined()
    expect(store.finalScores?.overall).toBeGreaterThan(0)

    // 5. Verify the attempt was saved in the database with correct scores
    const { data: attempt, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('id', attemptId)
      .single()

    expect(error).toBeNull()
    expect(attempt).not.toBeNull()
    expect(attempt.status).toBe('completed')
    expect(attempt.final_scores).toBeDefined()
    expect(attempt.final_scores.overall).toBeGreaterThan(0)

    // Since all answers were correct, we should get a perfect score
    // SAT total is 1600 (800 each for English and Math)
    expect(attempt.final_scores.overall).toBe(1600)
    expect(attempt.final_scores.english).toBe(800)
    expect(attempt.final_scores.math).toBe(800)

    // 6. Verify all user answers were saved correctly
    const { data: userAnswers, error: answersError } = await supabase
      .from('user_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    expect(answersError).toBeNull()
    expect(userAnswers).not.toBeNull()
    
    // Should have answers for all questions across all modules
    const totalQuestions = Object.values(testData.questions)
      .flat()
      .length
    expect(userAnswers!.length).toBe(totalQuestions)

    // All answers should be marked as correct
    const correctAnswersCount = userAnswers!.filter(answer => answer.is_correct).length
    expect(correctAnswersCount).toBe(totalQuestions)
  }, 60000) // Increase timeout for this comprehensive test

  it('should handle partial completion correctly', async () => {
    const store = useExamStore.getState()

    // Initialize and start exam
    await store.initializeExam(testData.exam.id, testData.user.id)
    await store.startExam()

    const attemptId = store.attempt!.id

    // Answer only half the questions in the first module
    const firstModule = store.modules[0]
    const halfQuestions = Math.floor(firstModule.questions.length / 2)

    for (let i = 0; i < halfQuestions; i++) {
      store.goToQuestion(i)
      const currentQuestion = store.getCurrentQuestion()
      const correctAnswer = getCorrectAnswerForQuestion(currentQuestion!)
      store.setLocalAnswer(correctAnswer)
    }

    // Save answers for this module
    await store.saveModuleAnswers()

    // Verify answers were saved
    const { data: partialAnswers, error } = await supabase
      .from('user_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    expect(error).toBeNull()
    expect(partialAnswers?.length).toBe(halfQuestions)
  })

  it('should handle exam time expiration correctly', async () => {
    const store = useExamStore.getState()

    // Initialize and start exam
    await store.initializeExam(testData.exam.id, testData.user.id)
    await store.startExam()

    // Answer a few questions
    const firstModule = store.modules[0]
    for (let i = 0; i < 3; i++) {
      store.goToQuestion(i)
      const currentQuestion = store.getCurrentQuestion()
      const correctAnswer = getCorrectAnswerForQuestion(currentQuestion!)
      store.setLocalAnswer(correctAnswer)
    }

    // Simulate time expiration
    store.timeExpired()
    expect(store.status).toBe('time_expired')

    // Handle the expiration (this should advance to next module or complete exam)
    await store.handleTimeExpired()
    
    // Since it's the first module, it should advance to the next module
    if (store.modules.length > 1) {
      expect(store.currentModuleIndex).toBe(1)
    } else {
      expect(store.status).toBe('completed')
    }
  })
})