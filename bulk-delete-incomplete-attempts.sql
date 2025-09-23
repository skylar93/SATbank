-- 🚨 불완전한 TEST ATTEMPTS 일괄 삭제 가이드 🚨
-- kayla의 점수가 이상한 attempts들 정리

-- ============================================
-- 1단계: 삭제 대상 확인
-- ============================================

-- 1-1. kayla의 모든 attempts 확인
SELECT
    id,
    exam_id,
    status,
    final_scores,
    created_at,
    completed_at
FROM test_attempts
WHERE user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
ORDER BY created_at DESC;

-- 1-2. 삭제 후보 attempts (점수가 이상한 것들)
SELECT
    ta.id,
    e.name as exam_name,
    ta.status,
    ta.final_scores,
    ta.created_at,
    (SELECT COUNT(*) FROM user_answers WHERE attempt_id = ta.id) as answer_count
FROM test_attempts ta
LEFT JOIN exams e ON ta.exam_id = e.id
WHERE ta.user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
    AND (
        -- 총점이 낮거나 (400 미만)
        CAST(ta.final_scores->>'overall' AS INTEGER) < 400
        -- 또는 final_scores가 null이거나 비어있는 경우
        OR ta.final_scores IS NULL
        OR ta.final_scores = '{}'
        -- 또는 모든 모듈 점수가 0인 경우 (만약 module_scores에 기록되어 있다면)
    )
ORDER BY ta.created_at DESC;

-- ============================================
-- 2단계: 특정 IDs로 삭제 (안전하게!)
-- ============================================

-- 삭제할 attempt IDs (위에서 확인한 후 수동으로 입력)
-- 예시: 2f6448cf, 0cdb0afc, 11f86e91, 63dc269e 등

BEGIN;

-- 2-1. user_answers 먼저 삭제
DELETE FROM user_answers
WHERE attempt_id IN (
    '2f6448cf-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '0cdb0afc-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '11f86e91-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '63dc269e-0f24-42b7-8a5b-3a0451e3abbf'   -- 이건 우리가 아는 전체 ID
);

-- 2-2. test_attempts 삭제
DELETE FROM test_attempts
WHERE id IN (
    '2f6448cf-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '0cdb0afc-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '11f86e91-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 실제 전체 ID로 바꿔주세요
    '63dc269e-0f24-42b7-8a5b-3a0451e3abbf'   -- October C
);

-- 2-3. 삭제 확인
SELECT 'Deleted attempts check' as check_type,
       COUNT(*) as remaining_count
FROM test_attempts
WHERE user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792';

-- 확인 후 COMMIT 또는 ROLLBACK
-- COMMIT;
-- ROLLBACK;

-- ============================================
-- 3단계: 최종 정리된 결과 확인
-- ============================================

-- kayla의 정상적인 attempts만 남았는지 확인
SELECT
    ta.id,
    e.name as exam_name,
    ta.status,
    ta.final_scores,
    ta.created_at,
    (SELECT COUNT(*) FROM user_answers WHERE attempt_id = ta.id) as answer_count
FROM test_attempts ta
LEFT JOIN exams e ON ta.exam_id = e.id
WHERE ta.user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
ORDER BY ta.created_at DESC;