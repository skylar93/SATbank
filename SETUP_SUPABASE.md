# Supabase Setup Guide

## Quick Setup Steps

You're getting the "Cannot read properties of undefined (reading 'from')" error because the Supabase environment variables are not set up. Here's how to fix it:

### 1. Create Environment Variables File

Create a `.env.local` file in your project root (same directory as `package.json`):

```bash
# Copy the example file
cp .env.example .env.local
```

### 2. Get Your Supabase Credentials

You need to get these values from your Supabase project:

1. **Go to your Supabase project dashboard**: https://supabase.com/dashboard
2. **Go to Settings > API**
3. **Copy these values:**
   - Project URL
   - Anon/Public key

### 3. Update .env.local

Open `.env.local` and update these lines:

```bash
# Replace with your actual Supabase project values
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service role key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Restart Your Development Server

After setting up the environment variables, restart your Next.js development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
# or
pnpm dev
```

### 5. Set Up Your Supabase Database

If you haven't already set up your Supabase database:

1. **Run the migrations:**
   ```bash
   # If using Supabase CLI
   supabase db push
   
   # Or manually run the SQL files in your Supabase SQL editor:
   # - supabase/migrations/20240101000001_initial_schema.sql
   # - supabase/migrations/20240101000002_rls_policies.sql
   ```

2. **Seed the database with sample data:**
   ```bash
   # Run these SQL files in your Supabase SQL editor:
   # - supabase/seed/01_sample_data.sql
   # - supabase/seed/02_mock_questions.sql
   # - supabase/seed/03_update_exam_config.sql
   ```

### 6. Test the Connection

1. Visit `/debug` in your browser
2. Check if all tests pass
3. If successful, visit `/student/problem-bank` to see the questions

## Troubleshooting

### Still getting errors?

1. **Check browser console** for detailed error messages
2. **Verify your Supabase project is active** in the Supabase dashboard
3. **Make sure RLS is enabled** on your tables
4. **Check that your user has the student role** in the user_profiles table

### Common Issues:

- **"row-level security" errors**: Make sure you're logged in as a user with a profile in user_profiles table
- **"relation does not exist"**: Run the database migrations
- **"no questions found"**: Run the seed data scripts

### Need Help?

Check the browser console and the `/debug` page for specific error messages.