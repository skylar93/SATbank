-- 삭제 전 현재 상태 확인
SELECT 
    '=== 삭제 전 상태 ===' as step,
    id,
    title,
    template_id,
    is_custom_assignment,
    created_at
FROM exams 
WHERE id = '34018513-bcd3-4245-a806-3e0a277d403a';

-- 참조하는 문제들 확인
SELECT 
    '=== 참조 문제 확인 ===' as step,
    COUNT(*) as referenced_questions,
    STRING_AGG(DISTINCT q.exam_id::text, ', ') as source_exam_ids
FROM exam_questions eq
JOIN questions q ON eq.question_id = q.id
WHERE eq.exam_id = '34018513-bcd3-4245-a806-3e0a277d403a';

-- 시도 기록 확인
SELECT 
    '=== 시도 기록 확인 ===' as step,
    COUNT(*) as attempt_count
FROM test_attempts
WHERE exam_id = '34018513-bcd3-4245-a806-3e0a277d403a';