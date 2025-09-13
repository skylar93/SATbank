// Simple test script for grid-in validator
const { validateGridInAnswer, parseCorrectAnswers, formatCorrectAnswersDisplay } = require('./apps/web/lib/grid-in-validator.ts')

console.log('🧪 Testing Grid-In Validator...\n')

// Test 1: Parse correct answers
console.log('📋 Test 1: Parsing correct answers')
const testQuestions = [
  { correct_answers: ['3/4', '0.75'] },
  { correct_answers: '["3/4", "0.75"]' },
  { correct_answers: ['["18", "18.0"]'] },
  { correct_answer: '0.75', correct_answers: null }
]

testQuestions.forEach((q, i) => {
  console.log(`Question ${i+1}:`, parseCorrectAnswers(q))
})

console.log('\n✅ Test 2: Answer validation')
const question1 = { correct_answers: ['3/4', '0.75', '6/8'] }
const testAnswers = ['3/4', '0.75', '6/8', '12/16', '0.7500', '1/2', 'abc']

testAnswers.forEach(answer => {
  const result = validateGridInAnswer(question1, answer)
  console.log(`"${answer}" -> ${result.isCorrect ? '✓' : '✗'} ${result.matchedAnswer ? `(matched: ${result.matchedAnswer})` : ''}`)
})

console.log('\n🎨 Test 3: Display formatting')
const answers = ['3/4', '0.75', '6/8', '1/2', '0.5']
console.log('Multiple answers:', formatCorrectAnswersDisplay(answers))

console.log('\n✅ Grid-In validator tests completed!')