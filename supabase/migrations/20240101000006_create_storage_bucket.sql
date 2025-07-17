-- Create storage bucket for question assets (images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-assets',
  'question-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload question images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'question-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow public access to read uploaded images
CREATE POLICY "Public access to question images" ON storage.objects
FOR SELECT USING (bucket_id = 'question-assets');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update question images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'question-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete images
CREATE POLICY "Users can delete question images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'question-assets' 
  AND auth.role() = 'authenticated'
);