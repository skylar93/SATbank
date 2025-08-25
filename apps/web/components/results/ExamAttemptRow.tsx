'use client'

import Link from 'next/link'
import { useState } from 'react'
import { TestAttempt, Exam } from '../../lib/exam-service'
import { TableRow, TableCell } from '../ui/table'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  BookOpenIcon,
  DocumentTextIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { 
  getDisplayScore,
  formatExamDate,
  canShowAttemptResults 
} from '../../lib/analytics-utils'

interface ExamAttemptRowProps {
  attempt: TestAttempt & { exam?: Exam }
  resultVisibility: any
}

export function ExamAttemptRow({ attempt, resultVisibility }: ExamAttemptRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const canShowResults = canShowAttemptResults(attempt, resultVisibility)
  const finalScores = attempt.final_scores
  const moduleScores = attempt.module_scores
  
  // For now, we'll disable accuracy calculation until we have access to user_answers
  const accuracy = null

  return (
    <>
      {/* Main Row - Always Visible */}
      <TableRow className="hover:bg-gray-50">
        <TableCell className="w-10">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isOpen ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </TableCell>
        
        <TableCell className="font-medium">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center">
              <AcademicCapIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {attempt.exam?.title || 'SAT Practice Test'}
              </div>
              <div className="text-sm text-gray-500">
                ID: {attempt.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell>
          {attempt.completed_at ? (
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatExamDate(attempt.completed_at)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatExamDate(attempt.started_at!)}</span>
            </div>
          )}
        </TableCell>
        
        <TableCell>
          <div className="flex items-center justify-between">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full border ${
                attempt.status === 'completed' 
                  ? 'bg-green-100 text-green-700 border-green-200' 
                  : attempt.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-red-100 text-red-700 border-red-200'
              }`}
            >
              {attempt.status === 'completed' && 'Completed'}
              {attempt.status === 'in_progress' && 'In Progress'}
              {attempt.status === 'expired' && 'Expired'}
            </span>
            
            {attempt.status === 'completed' && (
              <div className="text-right">
                <div className="text-lg font-bold text-violet-600">
                  {canShowResults ? getDisplayScore(attempt) : '***'}
                </div>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expandable Content Row */}
      {isOpen && (
        <TableRow className="bg-gray-50">
          <TableCell colSpan={4} className="p-6">
            <div className="space-y-4">
              {/* Detailed Scores */}
              {attempt.status === 'completed' && canShowResults && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Detailed Scores</h4>
                  
                  {/* Final Scores (English + Math) */}
                  {finalScores && finalScores.english && finalScores.math && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="flex items-center space-x-2 mb-1">
                          <DocumentTextIcon className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-medium text-gray-900">English</span>
                        </div>
                        <div className="text-xl font-bold text-indigo-600">{finalScores.english}</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="flex items-center space-x-2 mb-1">
                          <BoltIcon className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-900">Math</span>
                        </div>
                        <div className="text-xl font-bold text-purple-600">{finalScores.math}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Module Scores */}
                  {moduleScores && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {Object.entries(moduleScores).map(([module, score]) => (
                        <div key={module} className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center space-x-2 mb-1">
                            {module.includes('english') ? (
                              <DocumentTextIcon className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <BoltIcon className="w-4 h-4 text-purple-600" />
                            )}
                            <span className="text-xs font-medium text-gray-900">
                              {module.replace(/(\d)/, ' $1').toUpperCase()}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-gray-800">{score || 0}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Accuracy */}
                  {accuracy !== null && (
                    <div className="bg-white p-3 rounded-lg border inline-block">
                      <div className="flex items-center space-x-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">Overall Accuracy</span>
                        <span className="text-lg font-bold text-green-600">{accuracy}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Hidden Results Message */}
              {attempt.status === 'completed' && !canShowResults && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      Results are currently hidden by your instructor
                    </span>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2 border-t border-gray-200">
                {attempt.status === 'completed' && canShowResults && (
                  <>
                    <Link
                      href={`/student/results/${attempt.id}`}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors text-sm font-medium"
                    >
                      <EyeIcon className="w-4 h-4" />
                      <span>View Detailed Analysis</span>
                    </Link>
                    
                    <Link
                      href={`/student/results/${attempt.id}/review`}
                      className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <BookOpenIcon className="w-4 h-4" />
                      <span>Review in Exam View</span>
                    </Link>
                  </>
                )}
                
                {attempt.status === 'in_progress' && (
                  <Link
                    href={`/student/exam/${attempt.exam_id}`}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-colors text-sm font-medium"
                  >
                    <BookOpenIcon className="w-4 h-4" />
                    <span>Continue Exam</span>
                  </Link>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}