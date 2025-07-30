-- Update admin account profile
-- This ensures the admin@admin.sat account has proper profile data

-- Insert or update the admin user profile
INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'admin@admin.sat',
    'admin',
    'admin'
) ON CONFLICT (id) 
DO UPDATE SET
    full_name = 'admin',
    role = 'admin',
    updated_at = NOW();

-- Also handle the case where the profile might exist with a different ID
-- by updating based on email if needed
INSERT INTO user_profiles (
    id,
    email,
    full_name,  
    role
)
SELECT 
    id,
    email,
    'admin' as full_name,
    'admin'::user_role as role
FROM auth.users 
WHERE email = 'admin@admin.sat'
AND id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Update existing profile if it exists with different data
UPDATE user_profiles 
SET 
    full_name = 'admin',
    role = 'admin',
    updated_at = NOW()
WHERE email = 'admin@admin.sat'
AND (full_name != 'admin' OR role != 'admin');