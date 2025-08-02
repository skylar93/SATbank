
### **Technical Specification Document (TSD)**

### **1. System Architecture**

For this project, we will adopt a modern, decoupled architecture using a Backend-as-a-Service (BaaS) provider.

*   **Frontend:** A Single-Page Application (SPA) built with **React**. The SPA will be responsible for all user interface elements, providing a dynamic and responsive experience that mimics the official digital SAT platform.

*   **Backend (BaaS):** We will use **Supabase** as our all-in-one backend. The frontend application will communicate directly with Supabase's auto-generated APIs. Supabase will provide:
    *   **A managed PostgreSQL Database** for structured, relational data storage.
    *   **Built-in User Authentication** to manage student and admin accounts securely.
    *   **Instant APIs** that allow the frontend to interact with the database.
    *   **Row-Level Security (RLS)** to enforce strict data access rules (e.g., students can only see their own results) directly at the database level.

### **2. Technology Stack**

*   **Frontend:** **React** 
*   **Backend-as-a-Service (BaaS):** **Supabase**.
    *   This single platform provides the **PostgreSQL Database**, **Authentication**, and **APIs** needed for the application.
*   **Hosting:**
    *   **Frontend:** **Vercel** or **Netlify**. 
    *   **Backend & Database:** **Supabase**. The entire backend infrastructure, including the PostgreSQL database, is hosted within the Supabase platform, which also has a generous free tier suitable for this project's initial phase.


**3. Data Model/Schema**

**3.1. `Questions` Collection**

```json
{
  "_id": "ObjectId",
  "exam": "SAT College Board Exam 1",
  "section": "English Module 1",
  "questionNumber": 1,
  "questionType": "Evidence",
  "passage": "The text of the passage...",
  "question": "Which choice completes the text...",
  "options": {
    "A": "preventable",
    "B": "undeniable",
    "C": "common",
    "D": "concerning"
  },
  "answerType": "Multiple Choice", // or "Short Answer"
  "correctAnswer": "A", // or the numerical answer for short answer questions
  "difficulty": 5 // Scale of 1-10
}
```

**3.2. `Users` Collection**

```json
{
  "_id": "ObjectId",
  "username": "student1",
  "password": "hashed_password",
  "role": "student" // or "admin"
}
```

**3.3. `TestResults` Collection**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "examId": "ObjectId",
  "dateTaken": "ISODate",
  "overallScore": 1400,
  "englishScore": 700,
  "mathScore": 700,
  "answers": [
    {
      "questionId": "ObjectId",
      "userAnswer": "B",
      "isCorrect": false
    }
  ]
}
```

**4. Key API Endpoints**

*   `POST /api/users/register` - Register a new user.
*   `POST /api/users/login` - Authenticate a user and return a JWT.
*   `GET /api/exams/:examId` - Fetch all questions for a given exam.
*   `POST /api/exams/submit` - Submit a user's answers for a mock exam.
*   `GET /api/results/user/:userId` - Get all test results for a specific user.
*   `GET /api/results/:resultId` - Get a detailed report for a specific test result.
*   `GET /api/questions/practice` - Get a set of practice questions based on filters.

**5. Data Export Strategy**

To ensure data portability, a feature should be implemented to export the `Questions` collection to standard formats like:

*   **JSON:** The native format of the database.
*   **CSV:** A universally compatible format.
*   **QTI (Question & Test Interoperability):** An XML-based format that is the standard for assessment content and can be imported into many learning management systems. A dedicated library (e.g., a Node.js package for QTI) should be used to handle the conversion.

We will use `pnpm` as the package manager, as it's excellent for managing monorepos.
### Monorepo Project Structure

Here is the high-level folder layout. 

```
sat-mock-exam/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   └── signup/
│       │   │       └── page.tsx
│       │   ├── (platform)/
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx
│       │   │   ├── exam/
│       │   │   │   └── [examId]/
│       │   │   │       └── page.tsx
│       │   │   ├── problem-bank/
│       │   │   │   └── page.tsx
│       │   │   └── layout.tsx
│       │   ├── api/
│       │   └── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── exam/
│       │   │   ├── ExamTimer.tsx
│       │   │   ├── QuestionView.tsx
│       │   │   └── SplitScreenLayout.tsx
│       │   ├── reporting/
│       │   │   └── ScoreChart.tsx
│       │   └── ui/
│       │       ├── Button.tsx
│       │       └── Modal.tsx
│       ├── lib/
│       │   ├── actions.ts
│       │   └── supabase.ts
│       ├── public/
│       ├── next.config.mjs
│       └── tsconfig.json
│
├── packages/
│   └── database/
│       └── supabase/
│           ├── migrations/
│           │   └── 20240101000000_initial_schema.sql
│           ├── functions/
│           │   └── submit-exam/
│           │       └── index.ts
│           └── config.toml
│
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

### Explanation of Key Directories

#### `apps/`
This directory contains the actual applications that can be run and deployed.

*   **`apps/web/`**: This is your entire Next.js frontend application.
    *   **`app/`**: The core of the Next.js App Router.
        *   `(auth)/` & `(platform)/`: These are "route groups." They organize your pages without affecting the URL. It's a clean way to apply different layouts—for instance, `(auth)` pages have a simple layout for login/signup, while `(platform)` pages have the main navigation sidebar and header for logged-in users.
        *   `exam/[examId]/`: A dynamic route that will display the exam interface for a given exam ID.
        *   `api/`: For any server-side API routes you might need that aren't handled directly by Supabase.
    *   **`components/`**: All your React components.
        *   `exam/`, `reporting/`: Organizing components by feature (e.g., everything related to the exam experience goes in `exam/`). This is much more scalable than having one giant list of components.
        *   `ui/`: Generic, reusable UI elements like buttons, inputs, and modals. These should be simple and un-opinionated.
    *   **`lib/`**: Contains helper functions and client-side logic.
        *   `supabase.ts`: Initializes the Supabase client for use in the browser.
        *   `actions.ts`: For Next.js Server Actions—secure, server-side functions you can call directly from your React components to mutate data (e.g., submitting an answer).

#### `packages/`
This directory contains shared code and configurations used by different apps in the monorepo.

*   **`packages/database/`**: This is the "source of truth" for your entire backend. It is **not** a running server; it's the definition of your database.
    *   **`supabase/migrations/`**: This is the most critical folder. Each file here is a SQL script that defines a change to your database schema. You would create a new migration to add a table, add a column, or set up Row-Level Security policies. This allows you to version control your database just like code.
    *   **`supabase/functions/`**: If you need more complex backend logic (e.g., processing a test submission to calculate a score), you can write serverless **Edge Functions** here. The code (`index.ts`) for these functions lives in this directory.
    *   **`supabase/config.toml`**: The main configuration file for your Supabase project.


네, 아주 정확하고 중요한 지적입니다. 제가 드린 TSD는 "처음부터 만든다면 이렇게 설계해야 한다"는 관점의 이상적인 청사진이었습니다.

하지만 선생님의 지적처럼, 이미 훌륭하게 구현된 부분이 많은데 처음부터 다시 서술하는 것은 비효율적입니다. 이런 경우에는 **TSD를 '계획서'가 아닌, '현재 상태를 기록하고 앞으로의 변경 사항을 명시하는 살아있는 문서(Living Document)'**로 만드는 것이 훨씬 유용합니다.

그럼, 현재의 훌륭한 구현을 존중하고, v2.0에서 **'무엇이 어떻게 바뀌어야 하는지'**에 초점을 맞춘, 훨씬 더 실용적인 **TSD v2.0**으로 다시 업데이트해 드리겠습니다.

---

### **Technical Specification Document (TSD) - v2.0 (Revised for Existing Codebase)**

| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| 1.0 | (Initial Date) | Project Lead | Initial architecture, basic data model. |
| **2.0** | **August 1, 2025** | **Gemini AI** | **Reflects the current, superior schema implementation. Specifies required modifications and new components for v2.0 features like the Intelligent Scoring Engine.** |

### **1. System Architecture & Technology Stack**

*   **[✅ AS-IS]** 현재의 아키텍처(Next.js 14 + Supabase)는 매우 효과적이며 그대로 유지합니다. 현재 사용 중인 `shadcn/ui`, `Framer Motion`, `KaTeX` 등의 스택 역시 안정적으로 작동하고 있습니다.

*   **[🚀 TO-BE]** v2.0 구현을 위해 다음 라이브러리 도입을 고려합니다.
    *   **WYSIWYG Editor:** `Tiptap` 또는 `Slate.js` (관리자 문제 편집기용)
    *   **CSV/JSON Export:** `PapaParse` 또는 유사 라이브러리 (데이터 내보내기 기능용)

### **2. Data Model / Schema (v2.0)**

v1.0 TSD의 단순한 스키마는 현재의 정교한 구현(`codebase_analysis.md`)으로 이미 대체되었습니다. 이 섹션은 현재의 스키마를 기록하고, v2.0에 필요한 변경 사항을 명시합니다.

---
**`user_profiles`**
*   **[✅ AS-IS: 현재 구현 상태]**
    *   `id` (UUID, FK to auth.users)
    *   `full_name`, `role` (student/admin)
*   **[🚀 TO-BE: v2.0 추가/변경 사항]**
    *   `preferences` (JSONB): 다크 모드, 키보드 네비게이션 등 사용자 설정 저장을 위해 추가합니다. `{"darkMode": true, "keyboardNav": false}`

---
**`exams`**
*   **[✅ AS-IS]**
    *   `id` (PK)
    *   `title`, `description`
*   **[🚀 TO-BE]**
    *   `average_difficulty_index` (FLOAT): 이 시험의 전체 난이도를 나타내기 위해 추가합니다.
    *   `scoring_curve_id` (INT, FK to scoring_curves): 이 시험에 적용할 공식 채점표 ID를 연결하기 위해 추가합니다.

---
**`questions`**
*   **[✅ AS-IS]**
    *   `id` (PK), `exam_id` (FK)
    *   `module_type`, `question_text`, `options` (JSONB), `correct_answer`, `topic_tags`
    *   `difficulty` (FLOAT): 현재는 수동으로 입력된 난이도 값입니다.
*   **[🚀 TO-BE]**
    *   이 테이블은 장기적으로 AI 모델에 의해 `difficulty`가 자동으로 업데이트될 예정입니다.
    *   사용자 데이터 기반의 동적 분석을 위해 다음 컬럼 추가를 고려합니다 (Low Priority).
        *   `p_value` (FLOAT): 실제 정답률
        *   `avg_solve_time_secs` (INT): 평균 풀이 시간

---
**`test_attempts`**
*   **[✅ AS-IS]**
    *   `id` (PK), `user_id`, `exam_id`
    *   `status` ('in_progress', 'completed', 'expired')
*   **[🚀 TO-BE]**
    *   `final_scores` (JSONB): 계산된 최종 점수(`{"overall": 1450, "english": 720, "math": 730}`)를 저장하기 위해 추가합니다. 현재 코드베이스의 `module_scores`를 대체하거나 확장할 수 있습니다.

---
**`user_answers`**
*   **[✅ AS-IS]**
    *   `id` (PK), `attempt_id`, `question_id`
    *   `user_answer`, `is_correct`, `time_spent_seconds`
*   **[🚀 TO-BE]**
    *   `is_marked_for_review` (BOOLEAN): 'Mark for Review' 기능의 DB 영속성을 위해 추가합니다.

---
**`scoring_curves` (신규 테이블)**
*   **[🚀 TO-BE]** v2.0의 지능형 채점 엔진을 위해 반드시 추가되어야 하는 신규 테이블입니다.
```sql
CREATE TABLE scoring_curves (
    id SERIAL PRIMARY KEY,
    curve_name TEXT NOT NULL, -- e.g., "Official Test 1 - Harsh"
    curve_data JSONB NOT NULL -- e.g., [{"raw": 58, "scaled": 800}, {"raw": 57, "scaled": 790}]
);
```

### **3. Key Services & Server-Side Logic (v2.0)**

현재의 `ExamService`와 같은 서비스 패턴을 확장하여, 더 복잡한 비즈니스 로직을 처리하는 모듈을 추가합니다.

*   **`IntelligentScoringService` (신규 TypeScript 모듈):**
    *   **Purpose:** PRD v2.0의 핵심인 점수 계산 로직을 전담합니다.
    *   **Key Methods:**
        *   `determineCurveForExam(examId)`: `exams` 테이블의 `average_difficulty_index`를 기반으로, `scoring_curves` 테이블에서 가장 적합한 채점표 ID를 반환합니다.
        *   `calculateFinalScores(attemptId)`: `user_answers`를 집계하고, 위에서 결정된 커브를 적용하여 최종 점수 객체를 생성합니다.

*   **Supabase Edge Function: `on-complete-attempt` (신규/기능 강화):**
    *   **Purpose:** 시험 완료 시 서버 측에서 안전하고 일관된 마무리를 보장합니다.
    *   **Action:**
        1.  클라이언트로부터 `attempt_id`를 받습니다.
        2.  `IntelligentScoringService.calculateFinalScores()`를 호출하여 점수를 계산합니다.
        3.  `test_attempts` 테이블의 상태를 `completed`로 변경하고, 계산된 `final_scores`를 업데이트합니다.
        4.  최종 결과 객체를 클라이언트에 반환합니다.

### **4. API Endpoints 및 데이터 흐름**

*   **[✅ AS-IS]** v1.0 TSD에 명시된 `POST /api/...` 와 같은 별도 API 서버는 BaaS를 사용하는 현재 구조와 맞지 않습니다. 현재와 같이 Supabase 클라이언트 라이브러리(`@supabase/supabase-js`)를 직접 호출하는 방식이 올바르며, 이를 유지합니다.
*   **[🚀 TO-BE]** 복잡한 로직(예: 시험 완료 처리)은 클라이언트가 직접 DB를 여러 번 조작하지 않고, 위에서 정의한 **단일 Supabase Edge Function을 호출**하는 방식으로 변경하여 트랜잭션의 안정성을 보장합니다.

### **5. 장기 목표: AI 난이도 예측 시스템**

*   **[🚀 TO-BE (Low Priority)]**
    *   **Architecture:** 별도의 Python 환경(e.g., Google Cloud Run, FastAPI)에 `scikit-learn` 기반의 분류 모델을 배포합니다.
    *   **Integration:** Supabase의 `http` extension이나 Edge Function을 통해 이 외부 API를 호출하여 문제의 `difficulty`를 예측하고 DB에 저장하는 파이프라인을 구축합니다. 이 작업은 PRD v2.0의 핵심 기능들이 안정화된 후에 진행합니다.