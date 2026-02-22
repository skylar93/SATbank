# Claude Project Guide

## Project Overview
- **Project Name**: SAT Mock Exam & Problem Bank
- **Goal**: SAT mock exam and problem bank platform for high school students
- **Scale**: 2 students, 1 admin (initial)
- **Timeline**: [Start Date] ~ [Target Completion Date]

## Current Progress Tracking
### Completed Tasks
- [x] PRD completed
- [x] TSD completed
- [x] Git initialization
- [x] Project structure setup
- [x] Supabase configuration
- [x] Database schema creation
- [x] RLS policies setup
- [x] Authentication system foundation
- [ ] Basic UI components
- [ ] Exam flow implementation

### Current Work in Progress
- Current stage: Ready for Phase 3 - Basic UI and Authentication

### Upcoming Tasks
1. Create project folder structure
2. Supabase project setup
3. Database schema creation
4. Build basic authentication system

## Technology Stack Decisions
- **Frontend**: Next.js 14 (App Router)
- **Backend**: Supabase (PostgreSQL + Auth + APIs)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context API (consider Zustand if needed)
- **Package Manager**: pnpm
- **Deployment**: Vercel (Frontend) + Supabase (Backend)

## Critical Project Requirements
### Core Features
1. **Mock Exam**: 4 modules (English 1,2 + Math 1,2)
2. **Timer System**: Time limits for each module
3. **Problem Bank**: Question filtering and practice mode
4. **Reporting**: Detailed score analysis

### Technical Constraints
- No navigation between modules (once moved forward, cannot go back)
- Fixed question order (no shuffling)
- Auto-close when time expires

## Development Guidelines
### Coding Conventions
- Component names: PascalCase (e.g., `ExamTimer`)
- Function names: camelCase (e.g., `handleSubmit`)
- File names: kebab-case (e.g., `exam-timer.tsx`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_QUESTIONS`)

### Folder Structure Rules
- `components/`: Reusable components
- `app/`: Next.js routing pages
- `lib/`: Utility functions and configurations
- `types/`: TypeScript type definitions

### Development Priorities
1. **High**: Authentication, basic exam structure, timer
2. **Medium**: Question display, answer storage, results screen
3. **Low**: Problem bank, admin dashboard, optimization

## ⚠️ Worktree Workflow — 반드시 읽을 것

### 구조 이해
```
SATbank/                          ← git main 브랜치 (production 기준)
  apps/web/                       ← main 브랜치의 실제 앱 코드
  .claude/worktrees/
    feature-xyz/                  ← Claude가 작업하는 feature 브랜치 (별도 격리)
      apps/web/                   ← 이 브랜치만의 앱 코드
    other-feature/
      apps/web/
```

### Claude 작업 원칙
- Claude는 **항상 worktree(feature 브랜치)에서 작업**한다 → main이 보호됨
- main을 직접 수정하는 것은 긴급 버그픽스 외에는 금지
- 작업 완료 후 반드시 사용자에게 **어떤 worktree에서 작업했는지** 알려줄 것

### 사용자가 Claude 작업을 테스트하는 방법
```bash
# 방법 A: worktree 안에서 직접 실행 (가장 간단)
cd /Users/skylar/Desktop/SATbank/.claude/worktrees/<worktree-이름>
pnpm dev

# 방법 B: main 폴더에서 브랜치 전환 후 실행
cd /Users/skylar/Desktop/SATbank
git checkout <feature-브랜치명>   # Claude가 작업한 브랜치명 확인 후
pnpm dev
git checkout main                 # 테스트 완료 후 복귀
```

### 작업 완료 후 main 반영 흐름
```
Claude 작업 (worktree) → 사용자 테스트 (위 방법 중 하나) → PR 또는 merge → main 반영
```

---

## Development & Deployment Workflow
**IMPORTANT**: Always follow the development workflow documented in `Workflow.md`

### Required Commands Before Any Code Changes
```bash
pnpm dev          # Test locally first
pnpm type-check   # Check for TypeScript errors
pnpm lint         # Check code style
pnpm build        # Verify build success
```

### Deployment Process
1. **Never push directly to main** - Create feature branches
2. **Use PR workflow** - Get preview deployments via Vercel
3. **Test thoroughly** - Check preview deployment before merging
4. **Reference**: See `Workflow.md` for complete deployment guide

## Database Schema Essentials
```sql
-- Main tables
- users (using Supabase Auth)
- exams (exam information)
- questions (question data)
- test_attempts (exam attempt records)
- user_answers (answer records)