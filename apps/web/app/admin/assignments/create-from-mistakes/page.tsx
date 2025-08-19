import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { CreateMistakeAssignmentClient } from '@/components/admin/CreateMistakeAssignmentClient'

async function getStudentsWithMistakes() {
  const { data: students, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      full_name,
      email,
      grade_level,
      mistake_count:mistake_bank(count)
    `)
    .eq('role', 'student')
    .order('full_name')

  if (error) {
    console.error('Error fetching students:', error)
    return []
  }

  return students || []
}

export default async function CreateMistakeAssignmentPage() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/student/dashboard')
  }

  const students = await getStudentsWithMistakes()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Assignment from Mistakes</h1>
          <p className="mt-2 text-gray-600">
            Generate custom assignments based on student mistakes to help them improve their weak areas.
          </p>
        </div>

        <CreateMistakeAssignmentClient students={students} />
      </div>
    </div>
  )
}