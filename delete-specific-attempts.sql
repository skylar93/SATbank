-- 🚨 특정 ATTEMPTS 안전 삭제 🚨
-- 삭제 대상 IDs:
-- 2f6448cf-767c-4f79-bf69-09259769f671
-- 0cdb0afc-2147-468d-af9c-d0cdae6b7c42
-- 11f86e91-3042-4e76-adb4-df30d271f0df
-- 5fee4629-6245-4899-af49-f713311cb665

-- ============================================
-- 1단계: 삭제 전 확인 (필수!)
-- ============================================

-- 1-1. 삭제할 attempts 정보 확인
SELECT
    id,
    exam_id,
    status,
    final_scores,
    created_at,
    completed_at
FROM test_attempts
WHERE id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- 1-2. 각 attempt의 user_answers 개수 확인
SELECT
    attempt_id,
    COUNT(*) as answer_count
FROM user_answers
WHERE attempt_id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
)
GROUP BY attempt_id;

-- 1-3. kayla 사용자인지 재확인
SELECT
    id,
    user_id,
    CASE
        WHEN user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792' THEN 'KAYLA ✓'
        ELSE 'OTHER USER ⚠️'
    END as user_check
FROM test_attempts
WHERE id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- ============================================
-- 2단계: 안전한 삭제 (트랜잭션)
-- ============================================

BEGIN;

-- 2-1. user_answers 먼저 삭제
DELETE FROM user_answers
WHERE attempt_id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- 2-2. test_attempts 삭제
DELETE FROM test_attempts
WHERE id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- 2-3. 삭제 확인
SELECT 'POST-DELETE CHECK' as status;

-- 삭제된 attempts가 더 이상 존재하지 않는지 확인
SELECT COUNT(*) as remaining_attempts
FROM test_attempts
WHERE id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- 삭제된 answers가 더 이상 존재하지 않는지 확인
SELECT COUNT(*) as remaining_answers
FROM user_answers
WHERE attempt_id IN (
    '2f6448cf-767c-4f79-bf69-09259769f671',
    '0cdb0afc-2147-468d-af9c-d0cdae6b7c42',
    '11f86e91-3042-4e76-adb4-df30d271f0df',
    '5fee4629-6245-4899-af49-f713311cb665'
);

-- ⚠️ 위 두 결과가 모두 0이면 COMMIT, 아니면 ROLLBACK
-- COMMIT;
-- ROLLBACK;

-- ============================================
-- 3단계: 최종 확인
-- ============================================

-- kayla의 남은 정상적인 attempts 확인
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