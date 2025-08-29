'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { v4 as uuidv4 } from 'uuid'

interface VocabImageUploaderProps {
  onUploadSuccess: (imageUrl: string) => void
  onCancel: () => void
  userId: string
  accept?: string
  maxSize?: number // in MB
  className?: string
}

export function VocabImageUploader({
  onUploadSuccess,
  onCancel,
  userId,
  accept = 'image/*',
  maxSize = 5,
  className = '',
}: VocabImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return
      const file = acceptedFiles[0]

      // Validate file size
      if (file.size > maxSize * 1024 * 1024) {
        setError(`File size must be less than ${maxSize}MB`)
        return
      }

      setUploading(true)
      setError(null)

      try {
        // Generate unique filename with user ID namespace
        const fileExt = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `${userId}/${fileName}`

        // Upload to Supabase Storage (using vocab-images bucket)
        const { error: uploadError } = await supabase.storage
          .from('vocab-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('vocab-images').getPublicUrl(filePath)

        console.log('✅ Vocab image uploaded successfully:', { filePath, publicUrl })
        onUploadSuccess(publicUrl)
      } catch (error) {
        console.error('Upload error:', error)
        setError('Failed to upload image. Please try again.')
      } finally {
        setUploading(false)
      }
    },
    [onUploadSuccess, maxSize, supabase, userId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    multiple: false,
  })

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
      <div
        {...getRootProps()}
        className={`p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-600 bg-blue-100'
            : 'border-blue-300 hover:border-blue-500'
        } ${className}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-800">Uploading image...</span>
            </div>
          </div>
        ) : isDragActive ? (
          <p className="text-center text-sm text-blue-800">
            Drop the image here...
          </p>
        ) : (
          <div className="text-center">
            <p className="text-sm text-blue-700">
              Drag & drop an image here, or click to select a file.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              PNG, JPG, GIF, WebP up to {maxSize}MB
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Add a visual association to help remember this word
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="text-right mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}