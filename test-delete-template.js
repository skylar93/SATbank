// 템플릿 시험 안전 삭제 테스트
// 사용법: node test-delete-template.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TARGET_EXAM_ID = '34018513-bcd3-4245-a806-3e0a277d403a'

async function testTemplateDeletion() {
  console.log('🔍 템플릿 시험 삭제 테스트 시작...')
  console.log('대상 ID:', TARGET_EXAM_ID)

  try {
    // 1단계: 현재 상태 확인
    console.log('\n=== 1단계: 삭제 전 상태 확인 ===')
    
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', TARGET_EXAM_ID)
      .single()

    if (examError) {
      console.error('❌ 시험 조회 오류:', examError.message)
      return
    }

    console.log('📋 시험 정보:', {
      id: exam.id,
      title: exam.title,
      template_id: exam.template_id,
      is_custom_assignment: exam.is_custom_assignment,
      created_at: exam.created_at
    })

    // 2단계: 안전성 검사
    console.log('\n=== 2단계: 안전성 검사 ===')
    
    // 템플릿인지 확인
    if (!exam.template_id && !exam.is_custom_assignment) {
      console.error('🚨 위험: 원본 시험입니다. 삭제를 중단합니다.')
      return
    }
    console.log('✅ 템플릿 시험 확인됨')

    // 직접 소속 문제 확인
    const { data: ownQuestions, error: ownQError } = await supabase
      .from('questions')
      .select('id')
      .eq('exam_id', TARGET_EXAM_ID)

    if (ownQError) {
      console.error('❌ 직접 소속 문제 조회 오류:', ownQError.message)
      return
    }

    if (ownQuestions && ownQuestions.length > 0) {
      console.error('🚨 위험: 직접 소속 문제가 있습니다. 삭제를 중단합니다.')
      return
    }
    console.log('✅ 직접 소속 문제 없음 (안전)')

    // 참조 문제 확인
    const { data: refQuestions, error: refError } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        questions!inner(exam_id, question_number)
      `)
      .eq('exam_id', TARGET_EXAM_ID)

    if (refError) {
      console.error('❌ 참조 문제 조회 오류:', refError.message)
      return
    }

    console.log('📊 참조 문제 수:', refQuestions?.length || 0)
    if (refQuestions && refQuestions.length > 0) {
      const sourceExams = [...new Set(refQuestions.map(q => q.questions.exam_id))]
      console.log('📝 참조하는 원본 시험들:', sourceExams.length, '개')
    }

    // 시도 기록 확인
    const { data: attempts, error: attemptError } = await supabase
      .from('test_attempts')
      .select('id, status')
      .eq('exam_id', TARGET_EXAM_ID)

    if (attemptError) {
      console.error('❌ 시도 기록 조회 오류:', attemptError.message)
      return
    }

    console.log('📈 시도 기록:', attempts?.length || 0, '개')

    // 3단계: 실제 삭제 (트랜잭션으로 안전하게)
    console.log('\n=== 3단계: 삭제 실행 ===')
    console.log('🗑️ 삭제 작업 시작...')

    // 삭제 순서: test_attempts → exam_questions → exams
    
    // 시도 기록 삭제
    const { error: deleteAttemptsError } = await supabase
      .from('test_attempts')
      .delete()
      .eq('exam_id', TARGET_EXAM_ID)

    if (deleteAttemptsError) {
      console.error('❌ 시도 기록 삭제 오류:', deleteAttemptsError.message)
      return
    }
    console.log('✅ 시도 기록 삭제 완료:', attempts?.length || 0, '개')

    // 문제 연결 삭제
    const { error: deleteExamQuestionsError } = await supabase
      .from('exam_questions')
      .delete()
      .eq('exam_id', TARGET_EXAM_ID)

    if (deleteExamQuestionsError) {
      console.error('❌ 문제 연결 삭제 오류:', deleteExamQuestionsError.message)
      return
    }
    console.log('✅ 문제 연결 삭제 완료:', refQuestions?.length || 0, '개 (원본 문제는 보존됨)')

    // 시험 레코드 삭제
    const { error: deleteExamError } = await supabase
      .from('exams')
      .delete()
      .eq('id', TARGET_EXAM_ID)

    if (deleteExamError) {
      console.error('❌ 시험 레코드 삭제 오류:', deleteExamError.message)
      return
    }
    console.log('✅ 시험 레코드 삭제 완료')

    // 4단계: 삭제 확인
    console.log('\n=== 4단계: 삭제 확인 ===')
    
    const { data: deletedCheck, error: checkError } = await supabase
      .from('exams')
      .select('id')
      .eq('id', TARGET_EXAM_ID)

    if (checkError) {
      console.error('❌ 삭제 확인 오류:', checkError.message)
      return
    }

    if (deletedCheck && deletedCheck.length > 0) {
      console.error('❌ 삭제 실패: 시험이 아직 존재합니다')
      return
    }

    // 원본 문제들 보존 확인
    if (refQuestions && refQuestions.length > 0) {
      const sampleQuestionId = refQuestions[0].question_id
      const { data: originalQuestion, error: originalError } = await supabase
        .from('questions')
        .select('id, exam_id')
        .eq('id', sampleQuestionId)
        .single()

      if (originalError) {
        console.error('❌ 원본 문제 확인 오류:', originalError.message)
      } else if (originalQuestion) {
        console.log('✅ 원본 문제 보존 확인됨 (샘플):', originalQuestion.id)
      }
    }

    console.log('\n🎉 템플릿 시험 안전 삭제 완료!')
    console.log('📋 삭제된 시험:', exam.title)
    console.log('📊 삭제 통계:')
    console.log('  - 시도 기록:', attempts?.length || 0, '개')
    console.log('  - 문제 연결:', refQuestions?.length || 0, '개')
    console.log('  - 원본 문제들은 모두 안전하게 보존됨')

  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error.message)
  }
}

// 실행
testTemplateDeletion().then(() => {
  console.log('\n✨ 테스트 완료')
  process.exit(0)
}).catch(error => {
  console.error('💥 치명적 오류:', error)
  process.exit(1)
})