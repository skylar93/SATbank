-- Setup Admin User Script
-- Run this in Supabase Dashboard > SQL Editor to set up admin privileges

-- First, let's check if there are any users in the system
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data,
    p.role as profile_role
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Set the first user as admin in both places (raw_user_meta_data and user_profiles)
-- This will make the first registered user an admin

-- Update raw_user_meta_data for the first user
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = (
    SELECT id FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1
);

-- Insert or update user profile for the first user
INSERT INTO public.user_profiles (id, role, email, full_name)
SELECT 
    id,
    'admin',
    email,
    COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users 
WHERE id = (
    SELECT id FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1
)
ON CONFLICT (id) 
DO UPDATE SET role = 'admin';

-- Verify the setup
SELECT 
    'Admin setup completed' as status,
    u.id,
    u.email,
    u.raw_user_meta_data->>'role' as metadata_role,
    p.role as profile_role
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE u.id = (
    SELECT id FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1
);