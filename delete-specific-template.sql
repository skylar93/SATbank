-- 특정 템플릿 시험 삭제 (바로 실행 가능한 버전)
-- 사용법: 아래 target_exam_id 값을 실제 ID로 바꾸고 전체 실행

DO $$
DECLARE
    -- 🔧 테스트 대상 템플릿 ID
    target_exam_id UUID := '34018513-bcd3-4245-a806-3e0a277d403a';
    
    -- 작업용 변수들
    exam_record RECORD;
    safety_passed BOOLEAN := TRUE;
    error_message TEXT := '';
    deleted_attempts INTEGER;
    deleted_exam_questions INTEGER;
BEGIN
    RAISE NOTICE '🔍 템플릿 시험 삭제 프로세스 시작...';
    RAISE NOTICE '대상 ID: %', target_exam_id;
    
    -- =============================================================================
    -- 1단계: 존재 확인
    -- =============================================================================
    SELECT * INTO exam_record FROM exams WHERE id = target_exam_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '❌ 삭제 대상 시험을 찾을 수 없습니다: %', target_exam_id;
    END IF;
    
    RAISE NOTICE '📋 발견된 시험: % (생성일: %)', exam_record.title, exam_record.created_at;
    
    -- =============================================================================
    -- 2단계: 안전성 검사
    -- =============================================================================
    RAISE NOTICE '🔒 안전성 검사 중...';
    
    -- 검사 1: 템플릿 시험인가?
    IF exam_record.template_id IS NULL AND exam_record.is_custom_assignment != TRUE THEN
        safety_passed := FALSE;
        error_message := '🚨 원본 시험은 삭제할 수 없습니다. 템플릿/커스텀 시험만 삭제 가능합니다.';
    ELSE
        RAISE NOTICE '✅ 템플릿/커스텀 시험 확인됨 (template_id: %, is_custom: %)', 
            exam_record.template_id, exam_record.is_custom_assignment;
    END IF;
    
    -- 검사 2: 직접 소유한 문제가 있나?
    IF EXISTS (SELECT 1 FROM questions WHERE exam_id = target_exam_id) THEN
        safety_passed := FALSE;
        error_message := '🚨 이 시험에 직접 소속된 문제들이 있습니다. 원본 시험일 가능성이 높습니다.';
    ELSE
        RAISE NOTICE '✅ 직접 소속 문제 없음 (안전)';
    END IF;
    
    -- 검사 3: 참조 문제 현황
    DECLARE
        ref_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO ref_count FROM exam_questions WHERE exam_id = target_exam_id;
        RAISE NOTICE '📊 참조 문제 수: %개', ref_count;
    END;
    
    -- 안전성 최종 판정
    IF NOT safety_passed THEN
        RAISE EXCEPTION '%', error_message;
    END IF;
    
    RAISE NOTICE '✅ 모든 안전성 검사 통과!';
    
    -- =============================================================================
    -- 3단계: 삭제 실행
    -- =============================================================================
    RAISE NOTICE '🗑️ 삭제 작업 시작...';
    
    -- 3-1: 시도 기록 삭제 (user_answers는 CASCADE로 자동 삭제)
    DELETE FROM test_attempts WHERE exam_id = target_exam_id;
    GET DIAGNOSTICS deleted_attempts = ROW_COUNT;
    RAISE NOTICE '✅ 삭제된 시도 기록: %개', deleted_attempts;
    
    -- 3-2: 문제 연결 삭제 (원본 문제는 보존됨)
    DELETE FROM exam_questions WHERE exam_id = target_exam_id;
    GET DIAGNOSTICS deleted_exam_questions = ROW_COUNT;
    RAISE NOTICE '✅ 삭제된 문제 연결: %개 (원본 문제는 안전하게 보존됨)', deleted_exam_questions;
    
    -- 3-3: 시험 레코드 삭제
    DELETE FROM exams WHERE id = target_exam_id;
    RAISE NOTICE '✅ 템플릿 시험 레코드 삭제 완료';
    
    -- =============================================================================
    -- 4단계: 삭제 확인
    -- =============================================================================
    IF EXISTS (SELECT 1 FROM exams WHERE id = target_exam_id) THEN
        RAISE EXCEPTION '❌ 삭제 실패: 시험이 아직 존재합니다';
    ELSE
        RAISE NOTICE '🎉 템플릿 시험 삭제 완료!';
        RAISE NOTICE '📋 삭제된 시험: %', exam_record.title;
        RAISE NOTICE '📊 삭제 통계 - 시도기록: %개, 문제연결: %개', deleted_attempts, deleted_exam_questions;
    END IF;
    
END $$;