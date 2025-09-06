-- 삭제 가능한 템플릿 시험들 찾기

-- 1. 모든 템플릿 시험 목록
SELECT 
    id,
    title,
    description,
    template_id,
    is_custom_assignment,
    created_at,
    CASE 
        WHEN template_id IS NOT NULL THEN '✅ 템플릿 (안전 삭제)'
        WHEN is_custom_assignment = true THEN '⚠️ 커스텀 (확인 필요)'
        ELSE '🚨 원본 (삭제 금지)'
    END as safety_status,
    -- 시도 기록 수
    (SELECT COUNT(*) FROM test_attempts WHERE exam_id = exams.id) as attempt_count
FROM exams 
WHERE template_id IS NOT NULL OR is_custom_assignment = true
ORDER BY created_at DESC;

-- 2. 각 템플릿이 참조하는 문제 수
SELECT 
    e.id,
    e.title,
    COUNT(eq.question_id) as referenced_questions,
    STRING_AGG(DISTINCT q.exam_id::text, ', ') as source_exam_ids
FROM exams e
LEFT JOIN exam_questions eq ON e.id = eq.exam_id
LEFT JOIN questions q ON eq.question_id = q.id
WHERE e.template_id IS NOT NULL OR e.is_custom_assignment = true
GROUP BY e.id, e.title
ORDER BY e.created_at DESC;