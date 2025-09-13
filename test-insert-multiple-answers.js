const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMultipleAnswersInsertion() {
  console.log('🧪 Testing Multiple Answers Insertion to Supabase\n');

  // 테스트용 Grid-in 문제들
  const testQuestions = [
    {
      exam_id: 1, // 기존 시험 ID 사용
      module_type: 'math_calculator',
      question_number: 999, // 테스트용 번호
      question_type: 'grid_in',
      content: 'Test Question: What is 3/4 as a decimal?',
      correct_answers: ['0.75', '3/4', '6/8', '12/16'],
      difficulty_level: 'easy',
      explanation: 'All these values are mathematically equivalent: 3÷4 = 0.75',
      points: 1
    },
    {
      exam_id: 1,
      module_type: 'math_no_calculator', 
      question_number: 998,
      question_type: 'grid_in',
      content: 'Test Question: If 2x + 1 = 17, what is x?',
      correct_answers: ['8', '8.0', '8.00', '16/2'],
      difficulty_level: 'medium',
      explanation: '2x + 1 = 17, so 2x = 16, therefore x = 8',
      points: 1
    }
  ];

  try {
    // 1. 데이터 삽입 테스트
    console.log('📝 Inserting test questions...');
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(testQuestions)
      .select('*');

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return;
    }

    console.log('✅ Successfully inserted questions:');
    insertedQuestions.forEach((q, i) => {
      console.log(`   ${i+1}. Question ${q.question_number}: [${q.correct_answers.join(', ')}]`);
    });

    // 2. 데이터 조회 테스트
    console.log('\n🔍 Retrieving inserted questions...');
    const { data: retrievedQuestions, error: selectError } = await supabase
      .from('questions')
      .select('id, question_number, content, correct_answers, question_type')
      .in('question_number', [999, 998]);

    if (selectError) {
      console.error('❌ Select error:', selectError);
      return;
    }

    console.log('✅ Retrieved questions:');
    retrievedQuestions.forEach((q) => {
      console.log(`   Q${q.question_number}: ${q.correct_answers} (${typeof q.correct_answers})`);
    });

    // 3. Grid-in Validator 테스트
    console.log('\n🧮 Testing with Grid-in Validator...');
    
    // 간단한 validator 함수들 (실제 모듈에서 가져온 로직)
    function normalizeAnswer(answer) {
      const trimmed = answer.trim();
      if (trimmed.includes('/')) {
        const [numerator, denominator] = trimmed.split('/').map(s => parseFloat(s.trim()));
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return (numerator / denominator).toString();
        }
      }
      const numValue = parseFloat(trimmed);
      if (!isNaN(numValue)) {
        return numValue.toString();
      }
      return trimmed.toLowerCase();
    }

    function answersAreEquivalent(answer1, answer2) {
      const norm1 = normalizeAnswer(answer1);
      const norm2 = normalizeAnswer(answer2);
      const num1 = parseFloat(norm1);
      const num2 = parseFloat(norm2);
      if (!isNaN(num1) && !isNaN(num2)) {
        return Math.abs(num1 - num2) < 0.0001;
      }
      return norm1 === norm2;
    }

    function validateAnswer(question, userAnswer) {
      if (!userAnswer?.trim()) return false;
      
      const correctAnswers = question.correct_answers || [];
      for (const correctAnswer of correctAnswers) {
        if (answersAreEquivalent(userAnswer, correctAnswer)) {
          return true;
        }
      }
      return false;
    }

    // 각 질문에 대해 다양한 답안 테스트
    const testCases = [
      { questionNum: 999, userAnswers: ['0.75', '3/4', '6/8', '9/12', '0.74', 'wrong'] },
      { questionNum: 998, userAnswers: ['8', '8.0', '16/2', '24/3', '7', 'invalid'] }
    ];

    testCases.forEach(testCase => {
      const question = retrievedQuestions.find(q => q.question_number === testCase.questionNum);
      console.log(`\n   Question ${testCase.questionNum} validation:`)
      
      testCase.userAnswers.forEach(userAnswer => {
        const isCorrect = validateAnswer(question, userAnswer);
        const status = isCorrect ? '✅' : '❌';
        console.log(`     "${userAnswer}" -> ${status}`);
      });
    });

    // 4. 정리 (테스트 데이터 삭제)
    console.log('\n🧹 Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .in('question_number', [999, 998]);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
    } else {
      console.log('✅ Test data cleaned up successfully');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// 환경 변수 확인
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
} else {
  testMultipleAnswersInsertion();
}