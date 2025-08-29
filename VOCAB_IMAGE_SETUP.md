# Vocab Bank Image Setup Instructions

## Database Migration
Run this SQL in Supabase SQL Editor to add the image_url column:

```sql
-- Add image_url column to vocab_entries table
ALTER TABLE public.vocab_entries
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.vocab_entries.image_url IS 'URL for an image associated with the vocabulary term from Supabase Storage';
```

## Storage Bucket Setup

### 1. Create Bucket
In Supabase Dashboard → Storage:
- Create a new public bucket named `vocab-images`

### 2. Set Up RLS Policies
In Supabase Dashboard → Storage → Policies, add these policies for the `vocab-images` bucket:

**SELECT Policy (Public Read):**
```sql
CREATE POLICY "Allow public read access to vocab images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'vocab-images' );
```

**INSERT Policy (Authenticated Upload):**
```sql
CREATE POLICY "Allow authenticated users to upload vocab images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'vocab-images' );
```

**UPDATE Policy (Owner Only):**
```sql
CREATE POLICY "Allow users to update their own vocab images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'vocab-images' AND auth.uid()::text = (storage.foldername(name))[1] )
WITH CHECK ( bucket_id = 'vocab-images' );
```

**DELETE Policy (Owner Only):**
```sql
CREATE POLICY "Allow users to delete their own vocab images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'vocab-images' AND auth.uid()::text = (storage.foldername(name))[1] );
```

## Features Implemented

### 1. Image Upload
- ✅ VocabImageUploader component created
- ✅ Integrated into Add/Edit word forms
- ✅ User-specific file paths (`userId/filename.ext`)
- ✅ File validation (size, type)
- ✅ Upload progress indicators

### 2. Text-to-Speech (TTS)
- ✅ useTTS hook created with Web Speech API
- ✅ Speaker button next to each vocabulary term
- ✅ Visual feedback during playback
- ✅ Adjustable speech rate for learning

### 3. Image Display
- ✅ Images shown in vocabulary entry cards
- ✅ Responsive sizing with max dimensions
- ✅ Alt text for accessibility

### 4. Database Support
- ✅ image_url column added to vocab_entries table
- ✅ Server actions updated to handle image URLs
- ✅ Type definitions updated

## Usage
1. Students can now add images to vocabulary words for visual association
2. Click the speaker icon next to any term to hear pronunciation
3. Images help with memory retention through visual learning
4. TTS helps with pronunciation and auditory learning

## Next Steps
- Consider adding image search/suggestion API integration
- Add pronunciation alternatives for different accents
- Implement image optimization/compression
- Add image alt-text editing for accessibility