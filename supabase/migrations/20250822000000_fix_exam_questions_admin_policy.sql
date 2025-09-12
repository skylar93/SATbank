-- Migration to fix admin access to exam_questions table
-- The current policy checks auth.users table which causes permission errors
-- We need to use the user_profiles table to check admin role

-- Drop existing admin policy for exam_questions
DROP POLICY IF EXISTS "Admins can manage exam questions" ON public.exam_questions;

-- Create the correct admin policies using user_profiles table
CREATE POLICY "Admins can manage exam questions" ON public.exam_questions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );