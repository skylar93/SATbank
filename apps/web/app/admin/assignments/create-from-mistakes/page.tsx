'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { CreateMistakeAssignmentClient } from '../../../../components/admin/CreateMistakeAssignmentClient'

interface Student {
  id: string
  full_name: string
  email: string
  grade_level: number
  mistake_count: { count: number }[]
}

export default function CreateMistakeAssignmentPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStudentsWithMistakes() {
      try {
        // First get all students
        const { data: studentsData, error: studentsError } = await supabase
          .from('user_profiles')
          .select(
            `
            id,
            full_name,
            email,
            grade_level
          `
          )
          .eq('role', 'student')
          .order('full_name')

        if (studentsError) {
          setError('Failed to load students')
          return
        }

        // Then get mistake counts for each student
        const studentsWithMistakeCounts = await Promise.all(
          (studentsData || []).map(async (student) => {
            const { count, error: countError } = await supabase
              .from('mistake_bank')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', student.id)

            if (countError) {
              return { ...student, mistake_count: [{ count: 0 }] }
            }

            return { ...student, mistake_count: [{ count: count || 0 }] }
          })
        )

        setStudents(studentsWithMistakeCounts || [])
      } catch (err) {
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    // Wait for auth to load, then check authorization
    if (!authLoading) {
      if (!user) {
        router.push('/login')
        return
      }

      if (user.profile?.role !== 'admin') {
        router.push('/student/dashboard')
        return
      }

      loadStudentsWithMistakes()
    }
  }, [user, authLoading, router])

  // Show loading while auth is being checked
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if something went wrong
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Error Loading Page
            </h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.push('/admin/assignments')}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Assignments
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show main content
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Create Assignment from Mistakes
          </h1>
          <p className="mt-2 text-gray-600">
            Generate custom assignments based on student mistakes to help them
            improve their weak areas.
          </p>
        </div>

        <CreateMistakeAssignmentClient students={students} />
      </div>
    </div>
  )
}
