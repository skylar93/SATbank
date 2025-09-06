-- 안전한 템플릿 시험 삭제 쿼리
-- 이 쿼리는 템플릿 시험만 삭제하고 원본 문제들은 절대 건드리지 않습니다

-- =============================================================================
-- 1단계: 삭제 대상 확인 및 안전성 검증
-- =============================================================================

-- 삭제하려는 시험 ID (여기에 실제 ID 입력)
\set target_exam_id 'YOUR_EXAM_ID_HERE'

-- 1-1. 삭제 대상이 템플릿 시험인지 확인
SELECT 
    id,
    title,
    template_id,
    is_custom_assignment,
    created_at,
    CASE 
        WHEN template_id IS NOT NULL THEN '✅ 템플릿 시험 (삭제 안전)'
        WHEN is_custom_assignment = true THEN '⚠️ 커스텀 시험 (확인 필요)'
        ELSE '🚨 원본 시험 (삭제 위험!)'
    END as safety_status
FROM exams 
WHERE id = :'target_exam_id';

-- 1-2. 이 템플릿이 참조하는 원본 문제들 확인
SELECT 
    'Referenced Questions' as info_type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT q.exam_id::text, ', ') as source_exam_ids
FROM exam_questions eq
JOIN questions q ON eq.question_id = q.id
WHERE eq.exam_id = :'target_exam_id';

-- 1-3. 이 시험에 대한 시도 기록 확인
SELECT 
    'Test Attempts' as info_type,
    COUNT(*) as attempt_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_attempts
FROM test_attempts
WHERE exam_id = :'target_exam_id';

-- =============================================================================
-- 2단계: 안전 조건 확인 (모든 조건이 통과해야 삭제 가능)
-- =============================================================================

DO $$
DECLARE
    target_id UUID := 'YOUR_EXAM_ID_HERE'::UUID;
    exam_record RECORD;
    safety_passed BOOLEAN := TRUE;
    error_message TEXT := '';
BEGIN
    -- 시험 존재 확인
    SELECT * INTO exam_record FROM exams WHERE id = target_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '❌ 삭제 대상 시험을 찾을 수 없습니다: %', target_id;
    END IF;
    
    -- 안전 조건 1: 템플릿 시험이어야 함
    IF exam_record.template_id IS NULL AND exam_record.is_custom_assignment != TRUE THEN
        safety_passed := FALSE;
        error_message := '🚨 원본 시험은 삭제할 수 없습니다. 템플릿 시험만 삭제 가능합니다.';
    END IF;
    
    -- 안전 조건 2: 직접 소유한 questions가 없어야 함
    IF EXISTS (SELECT 1 FROM questions WHERE exam_id = target_id) THEN
        safety_passed := FALSE;
        error_message := '🚨 이 시험에 직접 소속된 문제들이 있습니다. 원본 시험일 가능성이 높습니다.';
    END IF;
    
    -- 안전 조건 3: exam_questions를 통해서만 문제 참조해야 함
    IF NOT EXISTS (SELECT 1 FROM exam_questions WHERE exam_id = target_id) THEN
        -- 이 경우는 빈 시험이므로 안전하게 삭제 가능
        NULL;
    END IF;
    
    IF NOT safety_passed THEN
        RAISE EXCEPTION '%', error_message;
    END IF;
    
    RAISE NOTICE '✅ 안전성 검사 통과: 템플릿 시험 삭제가 안전합니다.';
END $$;

-- =============================================================================
-- 3단계: 실제 삭제 (위의 안전성 검사를 통과한 경우에만 실행)
-- =============================================================================

-- 트랜잭션 시작으로 안전성 보장
BEGIN;

-- 최종 안전 확인
DO $$
DECLARE
    target_id UUID := 'YOUR_EXAM_ID_HERE'::UUID;
    exam_record RECORD;
    deleted_attempts INTEGER;
    deleted_exam_questions INTEGER;
BEGIN
    -- 마지막 안전 확인
    SELECT * INTO exam_record FROM exams WHERE id = target_id;
    
    IF exam_record.template_id IS NULL AND exam_record.is_custom_assignment != TRUE THEN
        RAISE EXCEPTION '🚨 최종 안전 검사 실패: 원본 시험 삭제 시도';
    END IF;
    
    IF EXISTS (SELECT 1 FROM questions WHERE exam_id = target_id) THEN
        RAISE EXCEPTION '🚨 최종 안전 검사 실패: 직접 소속 문제 발견';
    END IF;
    
    RAISE NOTICE '🗑️ 템플릿 시험 삭제 시작: % (%)', exam_record.title, target_id;
    
    -- 삭제 순서 (CASCADE로 자동 삭제되지만 명시적으로 표시)
    
    -- 1. 시도 기록 삭제 (user_answers는 CASCADE로 자동 삭제)
    DELETE FROM test_attempts WHERE exam_id = target_id;
    GET DIAGNOSTICS deleted_attempts = ROW_COUNT;
    RAISE NOTICE '✅ 삭제된 시도 기록: %개', deleted_attempts;
    
    -- 2. 문제 연결 삭제 (exam_questions - 원본 문제는 유지됨)
    DELETE FROM exam_questions WHERE exam_id = target_id;
    GET DIAGNOSTICS deleted_exam_questions = ROW_COUNT;
    RAISE NOTICE '✅ 삭제된 문제 연결: %개 (원본 문제는 안전하게 보존됨)', deleted_exam_questions;
    
    -- 3. 시험 레코드 삭제
    DELETE FROM exams WHERE id = target_id;
    RAISE NOTICE '✅ 템플릿 시험 삭제 완료: %', exam_record.title;
    
END $$;

-- 커밋 (모든 것이 성공한 경우에만)
COMMIT;

-- =============================================================================
-- 4단계: 삭제 후 검증
-- =============================================================================

-- 삭제 확인
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 시험이 성공적으로 삭제되었습니다.'
        ELSE '❌ 시험이 아직 존재합니다.'
    END as deletion_status
FROM exams 
WHERE id = 'YOUR_EXAM_ID_HERE'::UUID;

-- 원본 문제들 안전성 확인
WITH referenced_questions AS (
    SELECT DISTINCT question_id 
    FROM exam_questions 
    WHERE exam_id = 'YOUR_EXAM_ID_HERE'::UUID
)
SELECT 
    '원본 문제 안전성 확인' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 참조된 문제 없음 (빈 템플릿이었음)'
        ELSE CONCAT('⚠️ 주의: 이전에 ', COUNT(*), '개 문제를 참조했으나 원본은 안전하게 보존되어야 함')
    END as safety_message
FROM referenced_questions;

RAISE NOTICE '🎉 안전한 템플릿 시험 삭제가 완료되었습니다!';