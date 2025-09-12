# 🛡️ Supabase Dashboard 안전 쿼리 모음

## ⚠️ 삭제 전 반드시 실행할 체크 쿼리들

### 1. 현재 문제 수 확인
```sql
-- 전체 문제 수
SELECT COUNT(*) as total_questions FROM questions;

-- Mock exam 문제 수  
SELECT COUNT(*) as mock_questions 
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.is_mock_exam = true;

-- 일반 exam 문제 수
SELECT COUNT(*) as regular_questions 
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.is_mock_exam = false;
```

### 2. 삭제 대상 미리보기 (실제 삭제 전 꼭 실행!)
```sql
-- Mock exam 문제만 미리보기
SELECT 
  e.title as exam_title,
  e.is_mock_exam,
  COUNT(q.id) as question_count
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.is_mock_exam = true
GROUP BY e.id, e.title, e.is_mock_exam;

-- 특정 exam의 문제 미리보기 
SELECT 
  q.id,
  q.question_number,
  q.module_type,
  e.title
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.id = 'YOUR_EXAM_ID_HERE'
ORDER BY q.question_number;
```

## 💾 백업 쿼리 (결과를 복사해서 저장하세요!)

### 전체 문제 백업
```sql
-- 이 결과를 텍스트 파일로 저장하세요!
SELECT 
  jsonb_build_object(
    'backup_date', now(),
    'total_questions', COUNT(*),
    'questions', jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'exam_id', q.exam_id,
        'module_type', q.module_type,
        'question_number', q.question_number,
        'question_type', q.question_type,
        'question_text', q.question_text,
        'options', q.options,
        'correct_answer', q.correct_answer,
        'explanation', q.explanation,
        'exam_title', e.title,
        'is_mock_exam', e.is_mock_exam
      )
    )
  ) as backup_data
FROM questions q
JOIN exams e ON q.exam_id = e.id;
```

### Mock exam만 백업
```sql
SELECT 
  jsonb_build_object(
    'backup_date', now(),
    'backup_type', 'mock_exam_only',
    'total_questions', COUNT(*),
    'questions', jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'exam_id', q.exam_id,
        'module_type', q.module_type,
        'question_number', q.question_number,
        'question_text', q.question_text,
        'options', q.options,
        'correct_answer', q.correct_answer,
        'exam_title', e.title
      )
    )
  ) as mock_backup
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.is_mock_exam = true;
```

## ✅ 안전한 삭제 쿼리들

### Mock exam 문제만 안전하게 삭제 (Soft Delete)
```sql
-- 1단계: 백업 먼저 실행했는지 확인!

-- 2단계: 몇 개나 삭제될지 확인
SELECT COUNT(*) as will_be_deleted
FROM questions q
JOIN exams e ON q.exam_id = e.id 
WHERE e.is_mock_exam = true;

-- 3단계: 정말 확실하면 실행 (Soft Delete)
UPDATE questions 
SET deleted_at = now(), updated_at = now()
WHERE exam_id IN (
  SELECT id FROM exams WHERE is_mock_exam = true
);
```

### 특정 exam 문제만 삭제
```sql
-- 1단계: exam ID 확인
SELECT id, title, is_mock_exam 
FROM exams 
WHERE title ILIKE '%검색할_제목%';

-- 2단계: 삭제될 문제 수 확인
SELECT COUNT(*) as will_be_deleted
FROM questions 
WHERE exam_id = 'YOUR_SPECIFIC_EXAM_ID';

-- 3단계: 안전하게 삭제
UPDATE questions 
SET deleted_at = now(), updated_at = now()
WHERE exam_id = 'YOUR_SPECIFIC_EXAM_ID';
```

## 🔄 복구 쿼리들

### 최근 삭제된 문제 확인
```sql
SELECT 
  q.id,
  q.question_number,
  q.module_type,
  q.deleted_at,
  e.title as exam_title,
  e.is_mock_exam
FROM questions q
JOIN exams e ON q.exam_id = e.id
WHERE q.deleted_at IS NOT NULL
AND q.deleted_at > (now() - interval '7 days')
ORDER BY q.deleted_at DESC;
```

### 삭제된 문제 복구
```sql
-- 전체 복구
UPDATE questions 
SET deleted_at = null, updated_at = now()
WHERE deleted_at IS NOT NULL;

-- 특정 exam의 문제만 복구
UPDATE questions 
SET deleted_at = null, updated_at = now()
WHERE exam_id = 'YOUR_EXAM_ID' 
AND deleted_at IS NOT NULL;
```

## ⚡ 긴급 복구 (실수했을 때)

```sql
-- 방금 전 삭제한 것들 모두 복구
UPDATE questions 
SET deleted_at = null, updated_at = now()
WHERE deleted_at > (now() - interval '10 minutes');
```

## 🚨 절대 사용하지 말 것

```sql
-- ❌ 이런 쿼리는 절대 실행하지 마세요!
DELETE FROM questions WHERE exam_id = '...';
DELETE FROM questions;
TRUNCATE questions;
```

## ✅ 삭제 전 체크리스트

1. [ ] 백업 쿼리 실행하고 결과 저장
2. [ ] 삭제 대상 미리보기로 개수 확인
3. [ ] Mock exam만 삭제하려는지 다시 확인
4. [ ] UPDATE (soft delete) 쿼리 사용 (DELETE 금지)
5. [ ] 삭제 후 복구 가능 확인

---

**💡 기억하세요**: 
- 항상 UPDATE로 deleted_at을 설정 (DELETE 절대 금지!)
- 백업을 먼저, 미리보기를 거쳐, 그 다음 삭제
- 실수해도 복구 쿼리로 되돌릴 수 있어요!