-- Migration to fix admin access to mistake_bank table
-- The current policy checks auth metadata which is incorrect
-- We need to use the user_profiles table to check admin role

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all mistakes" ON public.mistake_bank;
DROP POLICY IF EXISTS "Admins can insert mistakes for any user" ON public.mistake_bank;
DROP POLICY IF EXISTS "Admins can update any mistakes" ON public.mistake_bank;

-- Create the correct admin policies using user_profiles table
CREATE POLICY "Admins can view all mistakes" ON public.mistake_bank
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Also add insert and update policies for admins (they might need to manage mistake data)
CREATE POLICY "Admins can insert mistakes for any user" ON public.mistake_bank
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update any mistakes" ON public.mistake_bank
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );