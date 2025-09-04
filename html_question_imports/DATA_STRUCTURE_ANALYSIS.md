# HTML Question Import Data Structure Analysis

## Overview
This document analyzes the structure and mapping between the extracted HTML question data and the SATbank database schema.

## 📁 Source Data Structure

### Collection Info
```json
{
  "collectionInfo": {
    "startTime": null,
    "endTime": "2025-09-01T13:26:40.578Z",
    "totalTestsFound": 17,
    "totalQuestionsCollected": 459,
    "successRate": 0,
    "exportedAt": "2025-09-01T13:26:40.578Z",
    "version": "1.1.0"
  }
}
```

### Test Structure
```json
{
  "testId": "module_1_august_2023",
  "testName": "module_1_august_2023", 
  "questionCount": 27,
  "collectedAt": "2025-09-01T03:31:26.164Z",
  "phase1Complete": true,
  "phase2Complete": false,
  "questions": [...] // Array of question objects
}
```

### Question Structure
```json
{
  "questionNumber": 1,
  "questionText": "Clean plain text version",
  "questionHTML": "Full HTML with styling and UI elements",
  "imageUrls": ["data:image/png;base64,iVBORw0KGg..."],
  "choices": [
    "A) Looked at",
    "B) Had questions about", 
    "C) Organized",
    "D) Was captivated by"
  ],
  "correctAnswer": "Looked at",
  "explanation": null,
  "questionType": "multiple_choice",
  "subject": "unknown",
  "extractedAt": "2025-09-01T03:26:03.205Z",
  "answerCollectedAt": "2025-09-01T03:31:26.172Z"
}
```

## 🗄️ Database Schema (Target Structure)

### Exams Table
```sql
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    is_mock_exam BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true, 
    total_questions INTEGER DEFAULT 154,
    time_limits JSONB DEFAULT '{"math1": 35, "math2": 55, "english1": 64, "english2": 35}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    -- ... other fields
);
```

### Questions Table
```sql
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id),
    question_number INTEGER NOT NULL,
    module_type ENUM('english1', 'english2', 'math1', 'math2'),
    question_type ENUM('multiple_choice', 'grid_in', 'essay'),
    difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    question_text TEXT NOT NULL,
    question_image_url VARCHAR,
    options JSONB, -- {"A": "text", "B": "text", ...}
    correct_answer JSONB, -- ["A"] for multiple choice
    explanation TEXT,
    points INTEGER DEFAULT 1,
    topic_tags TEXT[],
    content_format TEXT DEFAULT 'markdown',
    -- ... other fields
);
```

## 🔄 Field Mapping Analysis

### ✅ Direct Mappings
| Source Field | Target Field | Notes |
|-------------|-------------|-------|
| `questionNumber` | `question_number` | Direct integer mapping |
| `questionText` | `question_text` | Use clean text version |
| `explanation` | `explanation` | Direct mapping (often null) |
| `questionType` | `question_type` | All are "multiple_choice" |

### 🔧 Transform Required
| Source Field | Target Field | Transformation |
|-------------|-------------|---------------|
| `choices` | `options` | `["A) Text", "B) Text"]` → `{"A": "Text", "B": "Text"}` |
| `correctAnswer` | `correct_answer` | `"Looked at"` → `["A"]` (find matching option) |
| `subject` | `module_type` | `"unknown"` → `"english1"` (based on testId) |
| `imageUrls` | `question_image_url` | Base64 → Upload to Supabase Storage → URL |
| N/A | `content_format` | Set to `"html"` |
| N/A | `difficulty_level` | Default to `"medium"` |

### 📋 Test-Level Mappings
| Source | Target | Logic |
|--------|-------|-------|
| `testId: "module_1_august_2023"` | `module_type: "english1"` | Module 1 = english1 |
| `testName` | `exam.title` | "SAT August 2023 - Module 1 (English)" |
| `questionCount` | `exam.total_questions` | Direct mapping |

## 🚀 Import Strategy

### Phase 1: Data Preparation
1. **Create Exam Record**
   ```javascript
   const exam = {
     title: "SAT August 2023 - Module 1 (English)",
     description: "Imported from module_1_august_2023",
     total_questions: 27,
     time_limits: {"english1": 64},
     is_mock_exam: true
   }
   ```

2. **Process Images**
   ```javascript
   // Convert Base64 → Supabase Storage
   const imageUrl = await uploadBase64ToSupabase(question.imageUrls[0])
   ```

### Phase 2: Data Transformation
```javascript
function transformQuestion(sourceQuestion, examId) {
  return {
    exam_id: examId,
    question_number: sourceQuestion.questionNumber,
    module_type: 'english1', // Based on testId
    question_type: 'multiple_choice',
    question_text: sourceQuestion.questionText,
    question_image_url: uploadedImageUrl,
    options: transformChoicesToOptions(sourceQuestion.choices),
    correct_answer: findCorrectAnswerKey(sourceQuestion.choices, sourceQuestion.correctAnswer),
    explanation: sourceQuestion.explanation,
    difficulty_level: 'medium',
    content_format: 'html',
    points: 1
  }
}

function transformChoicesToOptions(choices) {
  // ["A) Looked at", "B) Had questions"] → {"A": "Looked at", "B": "Had questions"}
  const options = {}
  choices.forEach(choice => {
    const [key, ...textParts] = choice.split(') ')
    options[key] = textParts.join(') ')
  })
  return options
}

function findCorrectAnswerKey(choices, correctAnswer) {
  // Find which option key (A, B, C, D) matches the correctAnswer text
  for (const choice of choices) {
    const [key, ...textParts] = choice.split(') ')
    const text = textParts.join(') ')
    if (text === correctAnswer) {
      return [key] // Return as array for JSONB
    }
  }
  return ['A'] // Fallback
}
```

### Phase 3: Database Operations
1. Insert exam record
2. Transform and insert all questions
3. Validate data integrity
4. Update exam statistics

## ⚠️ Potential Issues & Solutions

### Issue 1: Choice Format Variations
- **Problem**: Some choices might not follow "A) Text" pattern
- **Solution**: Add regex validation and fallback parsing

### Issue 2: Image Upload Limits  
- **Problem**: Large Base64 images may exceed size limits
- **Solution**: Compress images before upload, batch processing

### Issue 3: Duplicate Detection
- **Problem**: Same questions imported multiple times
- **Solution**: Check existing questions by text hash before insert

### Issue 4: Module Type Detection
- **Problem**: Need to determine english1 vs english2 
- **Solution**: Use testId patterns and question content analysis

## 🎯 Success Criteria

### Data Validation Checks
- [ ] All questions have valid options (A, B, C, D)
- [ ] All correct_answer values exist in options
- [ ] Image URLs are accessible
- [ ] Question numbers are sequential (1-27)
- [ ] No duplicate questions
- [ ] All required fields populated

### Integration Checks  
- [ ] Questions display correctly in exam interface
- [ ] Answer checking works properly
- [ ] Images render correctly
- [ ] Navigation between questions works
- [ ] Timer and module switching functional

## 📊 Current Dataset Summary

- **Total Tests Available**: 17
- **Total Questions**: 459
- **Current Import Target**: "module_1_august_2023" (27 questions)
- **Question Type**: All multiple_choice
- **Module Type**: English Module 1
- **Images**: Base64 encoded, need upload
- **Status**: Ready for import script development

## 📝 Next Steps

1. Develop transformation functions
2. Create Supabase Storage upload utility
3. Build import script with error handling
4. Test with small subset first
5. Full import with validation
6. Verify in exam interface