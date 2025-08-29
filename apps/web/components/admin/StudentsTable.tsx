import {
  ChartBarIcon,
  UserGroupIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import StudentReportRow from './StudentReportRow'

interface AttemptData {
  attempt_id: string
  completed_at: string
  duration_seconds: number
  final_scores: {
    english?: number
    math?: number
  } | null
  student_id: string
  student_full_name: string
  student_email: string
  exam_id: string
  exam_title: string
}

interface StudentData {
  student_id: string
  student_full_name: string
  student_email: string
  attempts: AttemptData[]
  avgScore: number
  totalAttempts: number
  lastActive: string
}

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface StudentsTableProps {
  students: StudentData[]
  sortConfig?: SortConfig
  onSort?: (key: string) => void
}

export default function StudentsTable({
  students,
  sortConfig,
  onSort,
}: StudentsTableProps) {
  const SortableHeader = ({
    sortKey,
    children,
  }: {
    sortKey: string
    children: React.ReactNode
  }) => {
    const isActive = sortConfig?.key === sortKey
    const isAsc = isActive && sortConfig?.direction === 'asc'

    return (
      <th
        className={`px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-purple-100 transition-colors ${
          isActive ? 'bg-purple-100' : ''
        }`}
        onClick={() => onSort?.(sortKey)}
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          {onSort && (
            <div className="flex flex-col">
              <ChevronUpIcon
                className={`w-3 h-3 ${isActive && isAsc ? 'text-purple-600' : 'text-gray-400'}`}
              />
              <ChevronDownIcon
                className={`w-3 h-3 -mt-1 ${isActive && !isAsc ? 'text-purple-600' : 'text-gray-400'}`}
              />
            </div>
          )}
        </div>
      </th>
    )
  }
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden mb-6">
      <div className="p-6 border-b border-purple-100">
        <div className="flex items-center">
          <UserGroupIcon className="w-6 h-6 text-purple-500 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">
            Students Overview
          </h3>
          <span className="ml-3 text-sm text-gray-500">
            ({students.length} student{students.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <p className="text-purple-600/70">No students found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
              <tr>
                <SortableHeader sortKey="student_name">Student</SortableHeader>
                <SortableHeader sortKey="avgScore">
                  Average Score
                </SortableHeader>
                <SortableHeader sortKey="totalAttempts">
                  Total Attempts
                </SortableHeader>
                <SortableHeader sortKey="lastActive">
                  Last Active
                </SortableHeader>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {students.map((student) => (
                <StudentReportRow key={student.student_id} student={student} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
