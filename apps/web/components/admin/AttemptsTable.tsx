import {
  ChartBarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import AttemptRow from './AttemptRow'

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

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface AttemptsTableProps {
  attempts: AttemptData[]
  sortConfig?: SortConfig
  onSort?: (key: string) => void
}

export default function AttemptsTable({
  attempts,
  sortConfig,
  onSort,
}: AttemptsTableProps) {
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
      <TableHead
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
      </TableHead>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <ChartBarIcon className="w-6 h-6 text-purple-500 mr-3" />
        <h3 className="text-lg font-semibold text-gray-900">
          Student Test Results
        </h3>
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-12">
          <ChartBarIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <p className="text-purple-600/70">No test results found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-full divide-y divide-purple-200">
            <TableHeader className="bg-gray-50">
              <TableRow>
                <SortableHeader sortKey="student_name">Student</SortableHeader>
                <SortableHeader sortKey="exam_title">Exam</SortableHeader>
                <SortableHeader sortKey="total_score">
                  Total Score
                </SortableHeader>
                <SortableHeader sortKey="english_score">English</SortableHeader>
                <SortableHeader sortKey="math_score">Math</SortableHeader>
                <SortableHeader sortKey="duration">Duration</SortableHeader>
                <SortableHeader sortKey="completed_at">
                  Completed
                </SortableHeader>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-purple-100">
              {attempts.map((attempt) => (
                <AttemptRow key={attempt.attempt_id} attempt={attempt} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
