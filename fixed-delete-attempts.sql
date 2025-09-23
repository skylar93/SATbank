-- 🚨 수정된 삭제 쿼리 (테이블 구조 확인 포함) 🚨

-- ============================================
-- 0단계: 테이블 구조 확인
-- ============================================

-- exams 테이블 구조 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'exams'
ORDER BY ordinal_position;

-- ============================================
-- 1단계: kayla의 모든 attempts 확인 (수정된 버전)
-- ============================================

-- 1-1. kayla의 모든 attempts 확인 (조인 없이)
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

-- 1-2. 각 attempt의 답변 개수 포함
SELECT
    ta.id,
    ta.exam_id,
    ta.status,
    ta.final_scores,
    ta.created_at,
    (SELECT COUNT(*) FROM user_answers WHERE attempt_id = ta.id) as answer_count
FROM test_attempts ta
WHERE ta.user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
ORDER BY ta.created_at DESC;

-- 1-3. 삭제 후보 확인 (점수가 이상한 것들)
SELECT
    id,
    exam_id,
    status,
    final_scores,
    created_at,
    (SELECT COUNT(*) FROM user_answers WHERE attempt_id = id) as answer_count
FROM test_attempts
WHERE user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
    AND (
        -- 총점이 낮거나 (400 미만)
        (final_scores->>'overall')::INTEGER < 400
        -- 또는 final_scores가 null이거나
        OR final_scores IS NULL
        OR final_scores = '{}'::jsonb
    )
ORDER BY created_at DESC;