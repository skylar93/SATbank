# SAT Mock Exam & Problem Bank - Codebase Analysis

## Project Overview
This is a comprehensive SAT mock exam platform built with Next.js 14 and Supabase, designed for high school students to practice SAT exams with proper time management and detailed analytics.

## Architecture & Technology Stack

### Frontend
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** + **shadcn/ui** for styling
- **Framer Motion** for animations
- **KaTeX** for mathematical expressions
- **React KaTeX** for inline math rendering

### Backend & Database
- **Supabase** (PostgreSQL + Authentication + APIs)
- **Row Level Security (RLS)** for data protection
- **Real-time subscriptions** for live updates

### Key Libraries
- `@supabase/supabase-js` for database operations
- `date-fns` for date manipulation
- `lucide-react` for icons
- `class-variance-authority` for component variants

## Database Schema

### Core Tables

**`user_profiles`** - Extends Supabase Auth users
- `id` (UUID, references auth.users)
- `email`, `full_name`, `role` (student/admin)
- `grade_level`, `target_score`

**`exams`** - Exam definitions
- `id`, `title`, `description`
- `is_mock_exam`, `is_active`, `total_questions`
- `time_limits` (JSONB): `{"english1": 64, "english2": 35, "math1": 35, "math2": 55}`

**`questions`** - Question bank
- `id`, `exam_id`, `module_type` (english1/english2/math1/math2)
- `question_type` (multiple_choice/grid_in/essay)
- `question_text`, `options` (JSONB), `correct_answer`
- `difficulty_level`, `topic_tags`, `table_data`

**`test_attempts`** - Student exam sessions
- `id`, `user_id`, `exam_id`, `status` (not_started/in_progress/completed/expired)
- `current_module`, `current_question_number`
- `time_spent` (JSONB), `module_scores` (JSONB)

**`user_answers`** - Individual answer records  
- `id`, `attempt_id`, `question_id`
- `user_answer`, `is_correct`, `time_spent_seconds`

## Component Architecture

### Core Components

**Authentication System**
- `AuthContext` (`contexts/auth-context.tsx`): Global auth state management
- `AuthService` (`lib/auth.ts`): Authentication operations
- `AuthStateManager` (`lib/auth-state-manager.ts`): Centralized auth state

**Exam Engine**
- `useExamState` (`hooks/use-exam-state.ts`): Complex exam state management
- `ExamService` (`lib/exam-service.ts`): Database operations for exams
- `ExamTimer` (`components/exam/exam-timer.tsx`): Real-time countdown timer
- `QuestionDisplay` (`components/exam/question-display.tsx`): Question rendering with math support
- `ExamNavigation` (`components/exam/exam-navigation.tsx`): Question navigation

**Main Exam Page** (`app/student/exam/[examId]/page.tsx`)
- Handles exam initialization and state management
- Supports both student exam mode and admin preview mode
- Complex navigation logic with module progression
- Timer expiration handling and auto-advance

### Key Features

**Rich Text Processing** (`components/exam/question-display.tsx:12-265`)
- Custom `renderTextWithFormattingAndMath()` function
- Supports: **bold**, *italic*, __underline__, ^^superscript^^, ~~subscript~~
- LaTeX math rendering: `$inline$` and `$$block$$`
- Tables, images, and special formatting
- Handles escaped characters and complex parsing

**Exam State Management** (`hooks/use-exam-state.ts`)
- Module-based progression (English 1→2, Math 1→2)
- Local answer storage with database sync
- Time tracking per module
- Conflict resolution for existing attempts
- Mark for review functionality

**Timer System** (`components/exam/exam-timer.tsx`)
- Visual countdown with color-coded urgency
- Auto-advance on expiration
- Pause/resume capability
- Integration with exam state

## Supabase Integration

### Row Level Security (RLS)
- **Student Access**: Own profiles, attempts, answers only
- **Admin Access**: Full access to all data
- **Helper Function**: `is_admin(user_id)` for role checks

### Key APIs Used
- `supabase.auth`: Authentication operations
- `supabase.from('table_name')`: CRUD operations
- Real-time subscriptions for live updates
- File upload via Supabase Storage

### API Patterns
```typescript
// Typical query pattern
const { data, error } = await supabase
  .from('questions')
  .select('*')
  .eq('exam_id', examId)
  .eq('module_type', moduleType)
  .order('question_number', { ascending: true })
```

## Important Functions & Services

### ExamService (`lib/exam-service.ts`)
- `getActiveExams()`: Fetch available exams
- `getQuestions(examId, moduleType)`: Load module questions
- `createTestAttempt()`: Initialize exam session
- `submitAnswer()`: Save student responses
- `calculateScore()`: Compute exam results
- `cleanupDuplicateAttempts()`: Handle conflicts

### useExamState Hook
- `initializeExam()`: Load exam data and questions
- `startExam()`: Begin timed session
- `nextModule()`: Progress between exam sections
- `handleTimeExpired()`: Auto-advance on timeout
- `saveModuleAnswers()`: Bulk save to database

### Authentication Flow
1. `AuthService.signIn()` → Supabase auth
2. `authStateManager` → Centralized state
3. `AuthContext` → React context distribution
4. Profile creation via database trigger

## File Structure
```
apps/web/
├── app/                    # Next.js routing
│   ├── admin/             # Admin dashboard pages
│   ├── student/           # Student interface pages
│   └── student/exam/[examId]/ # Main exam interface
├── components/            # Reusable React components
│   ├── exam/             # Exam-specific components
│   ├── problem-bank/     # Practice mode components
│   └── ui/               # Base UI components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Core services & utilities
└── supabase/migrations/  # Database schema definitions
```

## Key Workflows

### Student Exam Flow
1. Login → Dashboard → Select Exam
2. Conflict check for existing attempts
3. Exam initialization with questions loading
4. Timed progression through 4 modules
5. Auto-save answers, auto-advance on timeout
6. Final scoring and results display

### Admin Preview Mode
- Full navigation between modules/questions
- Live question editing with rich text editor
- No timer constraints or database saves
- Keyboard navigation (← → arrow keys)

### Problem Bank Practice
- Filter questions by topic/difficulty
- Generate custom practice quizzes
- Track incorrect answers for review
- Recommendation engine for weak areas

## Detailed Component Analysis

### AuthContext (`contexts/auth-context.tsx`)
**Purpose**: Centralized authentication state management
**Key Features**:
- Manages user session and profile data
- Provides `signIn`, `signUp`, `signOut` methods
- Role-based access control (`isAdmin`, `isStudent`)
- Integration with `AuthStateManager` for consistent state

**Critical Methods**:
```typescript
const { user, loading, signIn, signOut, isAdmin } = useAuth()
```

### ExamTimer (`components/exam/exam-timer.tsx`)
**Purpose**: Real-time countdown timer with visual feedback
**Key Features**:
- Color-coded urgency (green → yellow → orange → red)
- Automatic pause/resume functionality
- `onTimeExpired` callback for module advancement
- Format: MM:SS display with animations

**Usage**:
```typescript
<ExamTimer
  initialTimeSeconds={moduleTimeInSeconds}
  onTimeExpired={handleModuleComplete}
  isPaused={examPaused}
/>
```

### QuestionDisplay (`components/exam/question-display.tsx`)
**Purpose**: Renders questions with rich formatting and math support
**Key Features**:
- LaTeX math rendering via KaTeX
- Support for tables, images, formatted text
- Multiple choice and grid-in question types
- Admin editing capabilities in preview mode
- Mark for review functionality

**Rich Text Features**:
- `**bold**`, `*italic*`, `__underline__`
- `^^superscript^^`, `~~subscript~~`
- `$inline math$`, `$$block math$$`
- `{{table}}...{{/table}}` for data tables
- `![alt](url)` for images

### useExamState Hook (`hooks/use-exam-state.ts`)
**Purpose**: Complex state management for exam sessions
**State Structure**:
```typescript
interface ExamState {
  exam: Exam | null
  attempt: TestAttempt | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  existingAttempt: TestAttempt | null
  showConflictModal: boolean
}
```

**Key Methods**:
- `initializeExam()`: Load exam and questions
- `startExam()`: Begin timed session
- `nextModule()`: Advance to next section
- `saveModuleAnswers()`: Bulk save to database
- `handleTimeExpired()`: Auto-advance on timeout

### ExamService (`lib/exam-service.ts`)
**Purpose**: Database operations for exam functionality
**Core Methods**:
- `getActiveExams()`: Fetch available exams
- `getQuestions(examId, moduleType)`: Load module questions
- `createTestAttempt()`: Initialize new exam session
- `updateTestAttempt()`: Update attempt status/progress
- `submitAnswer()`: Save individual answers
- `calculateScore()`: Compute final scores
- `getDashboardStats()`: Student progress analytics

## Database Relationships

```
auth.users (Supabase Auth)
    ↓
user_profiles (role, grade_level, target_score)
    ↓
test_attempts (exam sessions)
    ↓
user_answers (individual responses)
    ↑
questions (linked to exams)
    ↑
exams (exam definitions)
```

## Security Model

### Row Level Security Policies
**Students can**:
- View their own profile and test attempts
- Create test attempts for active exams
- Submit answers to their own attempts
- View questions for active exams only

**Admins can**:
- View and modify all data
- Create/edit/delete exams and questions
- View all student progress and analytics
- Access admin preview mode

### Helper Functions
```sql
-- Check if user has admin role
CREATE FUNCTION is_admin(user_id UUID) RETURNS BOOLEAN
-- Automatically create user profile on signup
CREATE FUNCTION handle_new_user() RETURNS TRIGGER
```

## Performance Optimizations

### Database Indexing
```sql
-- Performance indexes from schema
CREATE INDEX idx_questions_exam_module ON questions(exam_id, module_type);
CREATE INDEX idx_test_attempts_user_status ON test_attempts(user_id, status);
CREATE INDEX idx_user_answers_attempt ON user_answers(attempt_id);
```

### React Optimizations
- `useCallback` for expensive functions
- `useMemo` for computed values
- Singleton pattern for Supabase client
- Local state management with periodic saves

## Error Handling

### Common Error Patterns
```typescript
try {
  const result = await ExamService.methodName()
  // Handle success
} catch (error) {
  setError(error.message)
  // Fallback behavior
}
```

### Conflict Resolution
- Duplicate attempt cleanup
- Existing session detection
- Modal-based user choice (continue/restart)
- Progress preservation on exit

## Deployment Architecture

### Environment Setup
- **Development**: Local Next.js + Remote Supabase
- **Production**: Vercel (Frontend) + Supabase (Backend)
- **Environment Variables**: Supabase URL and keys

### Build Process
```bash
pnpm dev          # Development server
pnpm type-check   # TypeScript validation
pnpm lint         # Code quality checks
pnpm build        # Production build
```

The codebase demonstrates sophisticated state management, real-time features, and a robust authentication system built specifically for educational assessment platforms.