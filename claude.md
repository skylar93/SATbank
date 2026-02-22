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

## ⚠️ File Edit Rules — Read Before Touching Any File

### Correct Paths (ALWAYS edit these)
- **Next.js app**: `/Users/skylar/Desktop/SATbank/apps/web/`
- **`pnpm dev` runs from**: `/Users/skylar/Desktop/SATbank/` (root)

### NEVER Edit These (git worktrees — separate branches, not reflected in pnpm dev)
```
/Users/skylar/Desktop/SATbank/.claude/worktrees/*/   ← ❌ 절대 수정 금지
```

### Before Editing Any File — Run This Check
```bash
# 수정할 파일이 메인 프로젝트에 있는지 반드시 확인
ls /Users/skylar/Desktop/SATbank/apps/web/<수정할 경로>
```

### What Are Worktrees?
`.claude/worktrees/` 안의 폴더들은 git worktree로, **다른 브랜치**를 별도 폴더에 체크아웃한 것.
거기서 파일을 수정해도 메인 `apps/web/`에는 전혀 반영되지 않음.

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