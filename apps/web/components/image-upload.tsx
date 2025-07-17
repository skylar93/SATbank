'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void
  accept?: string
  maxSize?: number // in MB
  className?: string
}

export function ImageUpload({ 
  onImageUploaded, 
  accept = "image/*", 
  maxSize = 5,
  className = ""
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `question-images/${fileName}`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('question-assets')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('question-assets')
        .getPublicUrl(filePath)

      onImageUploaded(publicUrl)
    } catch (error) {
      console.error('Upload error:', error)
      setError('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      // Reset the input
      event.target.value = ''
    }
  }

  return (
    <div className={className}>
      <label className="block">
        <input
          type="file"
          accept={accept}
          onChange={handleFileUpload}
          disabled={uploading}
          className="sr-only"
        />
        <div className={`
          border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer transition-colors
          ${uploading ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400 hover:bg-gray-50'}
        `}>
          {uploading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
              <span className="text-sm text-gray-600">Uploading...</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-sm text-gray-600">
                Click to upload an image
              </div>
              <div className="text-xs text-gray-500">
                PNG, JPG, GIF up to {maxSize}MB
              </div>
            </div>
          )}
        </div>
      </label>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}