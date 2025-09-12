# SAT 문제 데이터 Supabase 임포트 완전 가이드

## 📋 목표
`bluebook-sat-problems-2025-09-01.json` 파일을 Supabase 데이터베이스에 직접 임포트하는 시스템적 접근법

## 🔍 데이터 구조 분석

### 원본 JSON 구조 (bluebook-sat-problems-2025-09-01.json)
```json
{
  "collectionInfo": {...},
  "tests": [
    {
      "testId": "module_1_august_2023",
      "testName": "module_1_august_2023", 
      "questions": [
        {
          "questionNumber": 11,
          "questionText": "Impact of Four Key Industries on Oklahoma Economy in 2017...",
          "questionHTML": "<div>...</div>",
          "imageUrls": [
            "https://r2.bluebook.plus/img/86626291999171765113.png",
            "data:image/png;base64,..."
          ],
          "choices": [
            "A) below wholesale trade but above...",
            "B) above all three of the other industries..."
          ],
          "correctAnswer": "below wholesale trade but above...",
          "explanation": null,
          "questionType": "multiple_choice",
          "subject": "unknown"
        }
      ]
    }
  ]
}
```

### Supabase 스키마 (questions 테이블)
```sql
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    module_type TEXT NOT NULL CHECK (module_type IN ('english1', 'english2', 'math1', 'math2')),
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'grid_in')),
    question_text TEXT NOT NULL,
    options JSONB,  -- 중요: {"A": "text", "B": "text"} 형태
    correct_answer TEXT,  -- 중요: ['A'] 배열 형태
    correct_answers JSONB,
    explanation TEXT,
    difficulty_level TEXT,
    topic_tags TEXT[],
    question_image_url TEXT,  -- 중요: 첫 번째 URL 이미지만
    table_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_id, question_number, module_type)
);
```

### Exams 테이블 스키마
```sql
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    time_limits JSONB,  -- {"english1": 64, "english2": 0, "math1": 0, "math2": 0}
    total_questions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_mock_exam BOOLEAN DEFAULT false,
    is_custom_assignment BOOLEAN DEFAULT false,
    answer_check_mode TEXT DEFAULT 'exam_end',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔄 데이터 변환 매핑

| 원본 필드 | Supabase 필드 | 변환 방법 |
|-----------|---------------|-----------|
| `questionNumber` | `question_number` | 직접 매핑 |
| `questionText` | `question_text` | 직접 매핑 (HTML 버전보다 완전함) |
| `choices: ["A) text", "B) text"]` | `options: {"A": "text", "B": "text"}` | **중요**: 형태 변환 필요 |
| `correctAnswer: "text"` | `correct_answer: ['A']` | **중요**: 텍스트 매칭으로 글자 추출 후 배열화 |
| `imageUrls[0]` (URL 형태) | `question_image_url` | 첫 번째 URL 이미지만 추출 |
| `questionType` | `question_type` | 직접 매핑 |
| `testId: "module_1_august_2023"` | `module_type: "english1"` | **중요**: 변환 룩업 필요 |

## ⚠️ 발견된 문제점들과 해결책

### 1. Options 형식 문제
- **문제**: `["A) text", "B) text"]` → `{"A": "text", "B": "text"}` 변환 필요
- **해결**: 정규식으로 `A)` 부분 파싱

### 2. Correct Answer 추출 문제  
- **문제**: `"below wholesale trade but..."` → `['A']` 변환 필요
- **해결**: choices 배열과 텍스트 매칭으로 글자 찾기

### 3. 이미지 URL 추출 문제
- **문제**: `imageUrls` 배열에서 첫 번째 URL만 필요 (Base64 제외)
- **해결**: URL 형태만 필터링

### 4. Module Type 매핑 문제
- **문제**: `"module_1_august_2023"` → `"english1"` 변환
- **해결**: 매핑 테이블 사용

### 5. HTML 이미지/테이블 순서 문제
- **문제**: 현재 이미지가 하단에 렌더링됨
- **해결**: `questionHTML`에서 이미지 위치 파싱하여 `question_text`에 마크다운으로 삽입

## 🛠️ 핵심 변환 함수들

### 1. Options 변환
```javascript
function convertChoicesToOptions(choices) {
  const options = {};
  choices.forEach(choice => {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      options[letter] = text.trim();
    }
  });
  return options;
}
```

### 2. 정답 글자 추출
```javascript
function extractCorrectAnswerLetter(correctAnswer, choices) {
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      if (text.trim() === correctAnswer.trim()) {
        return letter;
      }
    }
  }
  return 'A'; // 기본값
}
```

### 3. 이미지 URL 추출
```javascript
function extractMainImageUrl(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) return null;
  
  // 첫 번째 URL 형태 이미지 찾기 (Base64 제외)
  const urlImage = imageUrls.find(url => 
    typeof url === 'string' && url.startsWith('https://')
  );
  
  return urlImage || null;
}
```

### 4. Module Type 매핑
```javascript
function mapModuleType(testId) {
  const mapping = {
    'module_1_august_2023': 'english1',
    'module_1_december_2023': 'english1', 
    'module_2_august_2023': 'english2',
    'math_module_1_august_2023': 'math1',
    'math_module_2_august_2023': 'math2'
  };
  
  // 기본 패턴 매칭
  if (testId.includes('module_1')) return 'english1';
  if (testId.includes('module_2')) return 'english2';
  if (testId.includes('math_module_1')) return 'math1';
  if (testId.includes('math_module_2')) return 'math2';
  
  return mapping[testId] || 'english1';
}
```

## 📝 현재 검증된 성공 사례

### August 2023 Module 1 - Question 11 & 12 임포트 성공 ✅

**Question 11 (Oklahoma Economy Table):**
- 원본: 706자 텍스트
- 이미지: `https://r2.bluebook.plus/img/86626291999171765113.png`
- Options: 4개 선택지 완벽 변환
- 정답: A 올바르게 추출
- Question ID: `69e6b532-8aa7-47b5-884d-4a0079feb6cf`

**Question 12 (Costa Rica Deforestation Graph):**
- 원본: 771자 텍스트  
- 이미지: `https://r2.bluebook.plus/img/08037752661401710982.png`
- Options: 4개 선택지 완벽 변환
- 정답: B 올바르게 추출
- Question ID: `601e6cc0-d7a3-48d1-88f5-efe12a4e6eb4`

## 🚀 다음 단계: 완전 자동화 스크립트

### 목표
1. **전체 JSON 파일 처리**: 모든 테스트, 모든 문제 자동 변환
2. **HTML 이미지 순서 보존**: 테이블 제목과 이미지 위치 정확한 매핑
3. **배치 삽입**: 대량 데이터 효율적 처리
4. **오류 처리**: 실패한 문제 별도 로깅

### 필요한 개선사항
1. **이미지 위치 파싱**: HTML에서 `<img>` 태그 위치 추출
2. **테이블 제목 처리**: `<strong>` 태그와 이미지 관계 매핑
3. **마크다운 변환**: HTML → 마크다운으로 이미지 순서 보존
4. **배치 처리**: 한 번에 여러 문제 삽입

## 📊 예상 결과
- **전체 처리량**: 수백 개 문제 자동 처리
- **정확도**: 95%+ (수동 검증 필요한 경우 별도 플래그)  
- **처리 시간**: 전체 파일 5분 이내
- **재사용성**: 다른 JSON 파일에도 동일하게 적용 가능

## 🔧 실행 방법
```bash
cd /Users/skylar/Desktop/SATbank/html_question_imports
node complete-bluebook-importer.js --test="august_2023" --module="english1" --confirm
```

## 📁 파일 구조
```
html_question_imports/
├── COMPLETE_IMPORT_GUIDE.md (이 파일)
├── complete-bluebook-importer.js (완전 변환 스크립트)
├── bluebook-sat-problems-2025-09-01.json (원본 데이터)
├── fix-and-import-august-2023.js (검증된 테스트 스크립트)
└── import-results.json (결과 로그)
```

# 미리보기
node complete-bluebook-importer.js --test="august_2023" --limit=5 --dry-run

# 실제 임포트  
node complete-bluebook-importer.js --test="august_2023" --limit=5 --confirm

# 전체 임포트
node complete-bluebook-importer.js --confirm