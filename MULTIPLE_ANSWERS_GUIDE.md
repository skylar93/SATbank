# 📋 Supabase Multiple Answers 저장 가이드

## 🎯 요약

Grid-in 문제의 multiple answers를 Supabase에 저장하는 방법들입니다.

## 📊 데이터베이스 스키마

```sql
-- questions 테이블의 관련 컬럼들
correct_answers text[]     -- Grid-in 문제용 (여러 정답)
correct_answer  jsonb      -- Multiple choice 문제용 (단일 정답)
question_type   question_type -- 'grid_in' | 'multiple_choice' | 'essay'
```

## 💾 저장 방법

### 1️⃣ SQL 직접 삽입 (추천)

```sql
-- 간단한 배열 문법
INSERT INTO questions (exam_id, module_type, question_number, question_type, content, correct_answers)
VALUES (1, 'math_calculator', 25, 'grid_in', 'What is 3/4 as a decimal?', 
        ARRAY['3/4', '0.75', '6/8', '12/16']);

-- PostgreSQL 배열 문법
INSERT INTO questions (exam_id, module_type, question_number, question_type, content, correct_answers)
VALUES (1, 'math_no_calculator', 15, 'grid_in', 'If 2x + 3 = 21, what is x?',
        '{"9", "9.0", "18/2", "27/3"}'::text[]);
```

### 2️⃣ JavaScript/TypeScript (Supabase Client)

```typescript
const { data, error } = await supabase
  .from('questions')
  .insert({
    exam_id: 1,
    module_type: 'math_calculator',
    question_number: 25,
    question_type: 'grid_in',
    content: 'What is 3/4 as a decimal?',
    correct_answers: ['3/4', '0.75', '6/8', '12/16'], // JavaScript 배열
    difficulty_level: 'medium'
  });
```

### 3️⃣ Bulk Insert (여러 문제 한번에)

```typescript
const questions = [
  {
    exam_id: 1,
    question_type: 'grid_in',
    content: 'What is 1/2 as a decimal?',
    correct_answers: ['0.5', '1/2', '2/4', '3/6']
  },
  {
    exam_id: 1, 
    question_type: 'grid_in',
    content: 'If x + 5 = 13, what is x?',
    correct_answers: ['8', '8.0', '16/2']
  }
];

const { data, error } = await supabase
  .from('questions')
  .insert(questions);
```

## 🎯 실제 SAT 문제 예시들

### 분수 ↔ 소수 변환
```sql
INSERT INTO questions VALUES (
  1, 'math_calculator', 25, 'grid_in',
  'Express 3/4 as a decimal.',
  ARRAY['0.75', '3/4', '6/8', '9/12', '12/16', '15/20']
);
```

### 방정식 해
```sql
INSERT INTO questions VALUES (
  1, 'math_no_calculator', 15, 'grid_in', 
  'If 3x - 7 = 41, what is x?',
  ARRAY['16', '16.0', '16.00', '48/3', '64/4']
);
```

### 백분율과 소수
```sql
INSERT INTO questions VALUES (
  1, 'math_calculator', 30, 'grid_in',
  'Express 25% as a decimal.',
  ARRAY['0.25', '0.250', '1/4', '2/8', '25/100']
);
```

## ⚡ 중요한 팁들

### ✅ 올바른 방법
- **수학적 동등값 모두 포함**: `['3/4', '0.75', '6/8']`
- **다양한 형태 허용**: `['9', '9.0', '9.00', '18/2']`
- **분수의 기약분 포함**: `['1/2', '2/4', '3/6']`
- **소수점 자릿수 변형**: `['0.75', '0.750', '0.7500']`

### ❌ 피해야 할 것들
- 수학적으로 다른 값: `['3/4', '1/2']` ❌
- 근사값: `['1/3', '0.33']` (정확하지 않음) ❌
- 빈 문자열: `['0.75', '', '3/4']` ❌
- 중복값: `['0.75', '0.75', '3/4']` ❌

## 🧮 Grid-in Validator와의 연동

저장된 데이터는 자동으로 `/apps/web/lib/grid-in-validator.ts`에서 처리됩니다:

```typescript
// 자동으로 처리되는 부분들:
// 1. JSON 파싱: '["3/4", "0.75"]' -> ['3/4', '0.75']  
// 2. 수학적 동등성: '6/8' === '0.75' ✅
// 3. 사용자 친화적 표시: "3/4 or 0.75 or 6/8"
```

## 🖥️ Admin UI에서 사용법

관리자 페이지에서 multiple answers를 입력할 때:

1. **태그 형식으로 입력**: 각 정답을 태그처럼 추가/삭제
2. **실시간 미리보기**: 입력한 정답들이 어떻게 표시될지 보여줌  
3. **중복 방지**: 이미 입력된 정답은 다시 추가되지 않음
4. **유효성 검사**: 빈 문자열이나 잘못된 형식 방지

## 🔍 데이터 조회 및 검증

```sql
-- 저장된 multiple answers 확인
SELECT question_number, content, correct_answers 
FROM questions 
WHERE question_type = 'grid_in';

-- 특정 답안이 포함된 문제 찾기
SELECT * FROM questions 
WHERE question_type = 'grid_in' 
AND '0.75' = ANY(correct_answers);
```

## 🚀 마이그레이션 (기존 데이터 변환)

기존 단일 정답을 multiple answers로 변환:

```sql
-- 기존 correct_answer를 correct_answers 배열로 변환
UPDATE questions 
SET correct_answers = ARRAY[correct_answer::text]
WHERE question_type = 'grid_in' 
AND correct_answers IS NULL 
AND correct_answer IS NOT NULL;
```

이제 수학적으로 동등한 모든 답안을 학생들이 입력할 수 있습니다! 🎉