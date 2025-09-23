-- 🚨 SAFE DELETE ATTEMPTS FUNCTION 🚨
-- 특정 attempt IDs를 안전하게 삭제하는 재사용 함수

-- ============================================
-- 함수 생성
-- ============================================

CREATE OR REPLACE FUNCTION safe_delete_attempts(
    attempt_ids TEXT[],  -- 삭제할 attempt ID 배열
    target_user_id TEXT DEFAULT 'c97a96e0-0bc7-413f-a265-77fa11b79792'  -- 기본값: kayla
)
RETURNS TABLE(
    status TEXT,
    message TEXT,
    affected_attempts INTEGER,
    affected_answers INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_check_count INTEGER;
    attempts_count INTEGER;
    answers_count INTEGER;
    deleted_attempts INTEGER;
    deleted_answers INTEGER;
BEGIN
    -- 1. 입력 validation
    IF array_length(attempt_ids, 1) IS NULL OR array_length(attempt_ids, 1) = 0 THEN
        RETURN QUERY SELECT 'ERROR'::TEXT, 'No attempt IDs provided'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- 2. 사용자 확인 (모든 attempts가 target_user_id 소유인지)
    SELECT COUNT(*) INTO user_check_count
    FROM test_attempts
    WHERE id = ANY(attempt_ids) AND user_id = target_user_id;

    SELECT COUNT(*) INTO attempts_count
    FROM test_attempts
    WHERE id = ANY(attempt_ids);

    IF user_check_count != attempts_count THEN
        RETURN QUERY SELECT
            'ERROR'::TEXT,
            format('User mismatch: %s/%s attempts belong to target user', user_check_count, attempts_count)::TEXT,
            0, 0;
        RETURN;
    END IF;

    -- 3. 삭제 전 개수 확인
    SELECT COUNT(*) INTO answers_count
    FROM user_answers
    WHERE attempt_id = ANY(attempt_ids);

    -- 4. 안전한 삭제 (트랜잭션 내에서)
    BEGIN
        -- user_answers 먼저 삭제
        DELETE FROM user_answers
        WHERE attempt_id = ANY(attempt_ids);

        GET DIAGNOSTICS deleted_answers = ROW_COUNT;

        -- test_attempts 삭제
        DELETE FROM test_attempts
        WHERE id = ANY(attempt_ids);

        GET DIAGNOSTICS deleted_attempts = ROW_COUNT;

        -- 5. 성공 결과 반환
        RETURN QUERY SELECT
            'SUCCESS'::TEXT,
            format('Deleted %s attempts and %s answers', deleted_attempts, deleted_answers)::TEXT,
            deleted_attempts,
            deleted_answers;

    EXCEPTION WHEN OTHERS THEN
        -- 에러 발생 시 롤백
        RETURN QUERY SELECT
            'ERROR'::TEXT,
            format('Deletion failed: %s', SQLERRM)::TEXT,
            0, 0;
    END;
END;
$$;

-- ============================================
-- 사용법 예시
-- ============================================

-- 예시 1: 단일 attempt 삭제
-- SELECT * FROM safe_delete_attempts(ARRAY['attempt-id-here']);

-- 예시 2: 여러 attempts 삭제
-- SELECT * FROM safe_delete_attempts(ARRAY[
--     'attempt-id-1',
--     'attempt-id-2',
--     'attempt-id-3'
-- ]);

-- 예시 3: 다른 사용자의 attempts 삭제
-- SELECT * FROM safe_delete_attempts(
--     ARRAY['attempt-id-here'],
--     'other-user-id-here'
-- );

-- ============================================
-- 실제 사용 - 위에서 확인한 4개 attempts 삭제
-- ============================================

-- 🔥 실제 삭제 실행
SELECT * FROM safe_delete_attempts(ARRAY[
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
]);

-- ============================================
-- 삭제 후 확인용 쿼리
-- ============================================

-- kayla의 남은 attempts 확인
SELECT
    id,
    exam_id,
    status,
    final_scores,
    created_at,
    (SELECT COUNT(*) FROM user_answers WHERE attempt_id = test_attempts.id) as answer_count
FROM test_attempts
WHERE user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
ORDER BY created_at DESC;

-- ============================================
-- 함수 삭제 (필요시)
-- ============================================

-- DROP FUNCTION IF EXISTS safe_delete_attempts(TEXT[], TEXT);