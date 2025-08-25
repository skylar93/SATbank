-- Migration File: create_vocab_bank_schema.sql
-- Purpose: Create tables for student-created vocabulary sets and quizzes

-- Table for Vocabulary Sets (the "Exam" created by the student)
CREATE TABLE public.vocab_sets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.vocab_sets IS 'A collection of vocabulary entries, created by a student.';

-- Table for Individual Vocabulary Entries (the "Words" in the exam)
CREATE TABLE public.vocab_entries (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    term TEXT NOT NULL,         -- The word/term, e.g., "ephemeral"
    definition TEXT NOT NULL,   -- The definition, e.g., "lasting for a very short time"
    example_sentence TEXT,
    mastery_level INT NOT NULL DEFAULT 0, -- 0-5 scale for spaced repetition
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.vocab_entries.mastery_level IS '0: New, 5: Mastered. Used for quiz generation.';

-- Table for Quiz Sessions (tracking quiz attempts)
CREATE TABLE public.quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    set_id BIGINT NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
    quiz_type TEXT NOT NULL, -- 'term_to_def', 'def_to_term'
    quiz_format TEXT NOT NULL, -- 'multiple_choice', 'written_answer'
    score_percentage FLOAT,
    questions_total INT NOT NULL DEFAULT 0,
    questions_correct INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_vocab_sets_user_id ON public.vocab_sets(user_id);
CREATE INDEX idx_vocab_entries_set_id ON public.vocab_entries(set_id);
CREATE INDEX idx_vocab_entries_user_id ON public.vocab_entries(user_id);
CREATE INDEX idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);

-- RLS Policies for vocab_sets
ALTER TABLE public.vocab_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vocab sets" ON public.vocab_sets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vocab sets" ON public.vocab_sets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocab sets" ON public.vocab_sets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocab sets" ON public.vocab_sets
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for vocab_entries
ALTER TABLE public.vocab_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vocab entries" ON public.vocab_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vocab entries" ON public.vocab_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocab entries" ON public.vocab_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocab entries" ON public.vocab_entries
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for quiz_sessions
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quiz sessions" ON public.quiz_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quiz sessions" ON public.quiz_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz sessions" ON public.quiz_sessions
    FOR UPDATE USING (auth.uid() = user_id);