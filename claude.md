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

## Database Schema Essentials
```sql
-- Main tables
- users (using Supabase Auth)
- exams (exam information)
- questions (question data)
- test_attempts (exam attempt records)
- user_answers (answer records)