-- 🚨 특정 TEST ATTEMPT 안전 삭제 가이드 🚨
-- Target Attempt ID: d78ceb7d-db61-40cc-a950-ec664bbfab52

-- ============================================
-- 1단계: 삭제 전 확인 (먼저 이걸로 확인해주세요!)
-- ============================================

-- 1-1. 삭제할 attempt 정보 확인
SELECT
    id,
    user_id,
    exam_id,
    status,
    final_scores,
    created_at,
    completed_at
FROM test_attempts
WHERE id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- 1-2. 이 attempt의 user_answers 개수 확인
SELECT
    COUNT(*) as answer_count,
    MIN(answered_at) as first_answer,
    MAX(answered_at) as last_answer
FROM user_answers
WHERE attempt_id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- 1-3. 혹시 다른 관련 데이터가 있는지 확인 (안전체크)
SELECT 'test_attempts' as table_name, COUNT(*) as count
FROM test_attempts
WHERE id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52'
UNION ALL
SELECT 'user_answers' as table_name, COUNT(*) as count
FROM user_answers
WHERE attempt_id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- ============================================
-- 2단계: 백업 생성 (삭제 전 필수!)
-- ============================================

-- 2-1. 삭제할 데이터 백업용 확인
SELECT 'BACKUP - test_attempts' as backup_type,
       json_agg(row_to_json(ta.*)) as backup_data
FROM test_attempts ta
WHERE ta.id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- 2-2. user_answers 백업용 확인
SELECT 'BACKUP - user_answers' as backup_type,
       json_agg(row_to_json(ua.*)) as backup_data
FROM user_answers ua
WHERE ua.attempt_id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- ============================================
-- 3단계: 실제 삭제 (트랜잭션 사용!)
-- ============================================

BEGIN;

-- 3-1. 먼저 user_answers 삭제 (외래키 때문에)
DELETE FROM user_answers
WHERE attempt_id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- 3-2. test_attempts 삭제
DELETE FROM test_attempts
WHERE id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- 3-3. 삭제 결과 확인
SELECT 'POST-DELETE CHECK' as check_type;

-- 삭제된 레코드가 없는지 확인
SELECT COUNT(*) as remaining_attempts
FROM test_attempts
WHERE id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

SELECT COUNT(*) as remaining_answers
FROM user_answers
WHERE attempt_id = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';

-- ⚠️ 여기서 결과를 확인하고 문제없으면 COMMIT, 문제있으면 ROLLBACK
-- COMMIT;   -- 확인 후 이 주석을 제거하고 실행
-- ROLLBACK; -- 문제가 있다면 이걸 실행

-- ============================================
-- 4단계: 최종 검증
-- ============================================

-- 4-1. kayla의 남은 attempts 확인
SELECT
    id,
    exam_id,
    status,
    final_scores,
    created_at
FROM test_attempts
WHERE user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
ORDER BY created_at DESC;

-- 4-2. 전체 데이터 무결성 확인
SELECT
    e.name as exam_name,
    COUNT(ta.id) as total_attempts,
    COUNT(ua.id) as total_answers
FROM exams e
LEFT JOIN test_attempts ta ON e.id = ta.exam_id
LEFT JOIN user_answers ua ON ta.id = ua.attempt_id
WHERE e.id = '6f4eb255-3d1a-4e4c-90f3-99364b63c91a'  -- December exam
GROUP BY e.id, e.name;