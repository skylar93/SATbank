'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AnswerReleaseModal from '@/components/admin/AnswerReleaseModal'
import { ExamRow } from './ExamRow'
import { Button } from '@/components/ui/button'
import { CreateExamModal } from './CreateExamModal'

// Interface for the data returned by get_admin_exams_list RPC
interface RpcExamData {
  id: string
  title: string
  description: string
  created_at: string
  is_active: boolean
  total_questions: number
  english_curve_id: number | null
  math_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  latest_attempt_visibility: boolean | null
  latest_attempt_visible_after: string | null
  total_attempts_count: number
  template_id: string | null
  default_answers_visible: boolean
  default_answers_visible_after: string | null
}

// Transformed interface for UI consumption
interface ExamWithCurves {
  id: string
  title: string
  description: string
  created_at: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  template_id: string | null
  scoring_groups?: { [key: string]: string[] }
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

export function ExamsListClient() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [exams, setExams] = useState<ExamWithCurves[]>([])
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<{ [key: string]: { scoring_groups: { [key: string]: string[] } } }>({});
  const [filteredExams, setFilteredExams] = useState<ExamWithCurves[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set())
  const [expandedTestTypes, setExpandedTestTypes] = useState<Set<string>>(new Set())
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
  const [allGroupsInitialized, setAllGroupsInitialized] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    examId: string
    examTitle: string
  }>({
    isOpen: false,
    examId: '',
    examTitle: '',
  })

  // Fetch templates first, then exams
  useEffect(() => {
    if (user && isAdmin) {
      fetchTemplates().then(() => {
        fetchExamsOptimized()
      })
    }
  }, [user, isAdmin])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_templates')
        .select('id, scoring_groups')

      if (error) {
        console.error('Error fetching templates:', error)
        return
      }

      const templatesMap: { [key: string]: { scoring_groups: { [key: string]: string[] } } } = {}
      data?.forEach(template => {
        templatesMap[template.id] = {
          scoring_groups: template.scoring_groups || {}
        }
      })
      setTemplates(templatesMap)
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchExamsOptimized = async () => {
    setLoading(true)
    try {
      // Use the optimized RPC function for better performance
      const { data: rpcData, error } = await supabase.rpc(
        'get_admin_exams_list'
      )

      if (error) {
        console.error('Error fetching exams:', error)
        return
      }

      // Transform RPC data to UI format
      const transformedData: ExamWithCurves[] = (rpcData || []).map(
        (exam: RpcExamData) => {
          // Determine answer release setting based on RPC data
          let answerReleaseSetting
          if (exam.latest_attempt_visibility === null) {
            // No attempts exist: use exam default settings
            if (!exam.default_answers_visible) {
              answerReleaseSetting = {
                type: 'hidden' as const,
              }
            } else if (
              exam.default_answers_visible &&
              !exam.default_answers_visible_after
            ) {
              answerReleaseSetting = {
                type: 'immediate' as const,
              }
            } else if (
              exam.default_answers_visible &&
              exam.default_answers_visible_after
            ) {
              answerReleaseSetting = {
                type: 'scheduled' as const,
                scheduled_date: new Date(exam.default_answers_visible_after),
              }
            }
          } else if (!exam.latest_attempt_visibility) {
            answerReleaseSetting = {
              type: 'hidden' as const,
            }
          } else if (
            exam.latest_attempt_visibility &&
            !exam.latest_attempt_visible_after
          ) {
            answerReleaseSetting = {
              type: 'immediate' as const,
            }
          } else if (
            exam.latest_attempt_visibility &&
            exam.latest_attempt_visible_after
          ) {
            answerReleaseSetting = {
              type: 'scheduled' as const,
              scheduled_date: new Date(exam.latest_attempt_visible_after),
            }
          }

          return {
            id: exam.id,
            title: exam.title,
            description: exam.description,
            created_at: exam.created_at,
            english_scoring_curve_id: exam.english_curve_id,
            math_scoring_curve_id: exam.math_curve_id,
            english_curve_name: exam.english_curve_name,
            math_curve_name: exam.math_curve_name,
            template_id: exam.template_id,
            scoring_groups: exam.template_id ? templates[exam.template_id]?.scoring_groups : undefined,
            answer_release_setting: answerReleaseSetting,
          }
        }
      )

      setExams(transformedData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filtering when data or search changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredExams(exams)
    } else {
      const filtered = exams.filter(
        (exam) =>
          exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredExams(filtered)
    }
  }, [exams, searchTerm])

  // Initialize all groups as expanded when exams are loaded
  useEffect(() => {
    if (filteredExams.length > 0 && !allGroupsInitialized) {
      const groupedExams = groupExamsByCategory(filteredExams)
      const dateGroups = new Set<string>()
      const testTypeGroups = new Set<string>()
      const regionGroups = new Set<string>()
      
      Object.keys(groupedExams).forEach(date => {
        dateGroups.add(date)
        
        // Add all test types for this date
        testTypeGroups.add(`${date}-fullTest`)
        testTypeGroups.add(`${date}-sectionExam`)
        testTypeGroups.add(`${date}-individualModule`)
        
        // Add all regions for this date
        regionGroups.add(`${date}-International`)
        regionGroups.add(`${date}-US`)
        regionGroups.add(`${date}-Other`)
      })
      
      setExpandedDateGroups(dateGroups)
      setExpandedTestTypes(testTypeGroups)
      setExpandedRegions(regionGroups)
      setAllGroupsInitialized(true)
    }
  }, [filteredExams, allGroupsInitialized])

  const handleAnswerVisibilityUpdate = async (
    visibilityOption: 'hidden' | 'immediate' | 'scheduled' | 'per_question',
    releaseTimestamp?: Date
  ) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch(
        '/api/functions/update-answer-visibility-for-exam',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            examId: modalState.examId,
            visibilityOption,
            releaseTimestamp: releaseTimestamp?.toISOString(),
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update answer visibility')
      }

      alert(
        `Successfully updated answer visibility for ${result.updatedAttempts} attempts`
      )

      // Refresh data after update
      await fetchExamsOptimized()
    } catch (error) {
      console.error('Error updating answer visibility:', error)
      alert('Failed to update answer visibility. Please try again.')
    }
  }

  const openAnswerModal = (examId: string, examTitle: string) => {
    setModalState({
      isOpen: true,
      examId,
      examTitle,
    })
  }

  const closeAnswerModal = () => {
    setModalState({
      isOpen: false,
      examId: '',
      examTitle: '',
    })
  }

  // Categorization helper functions
  const parseExamTitle = (title: string) => {
    // Extract date from title
    const dateMatch = title.match(/(\w+)\s+(\d{4})/)
    const date = dateMatch ? `${dateMatch[2]} ${dateMatch[1]}` : 'Unknown Date'
    
    // Determine exam type
    let examType: 'fullTest' | 'sectionExam' | 'individualModule' = 'individualModule'
    let region: 'International' | 'US' | 'Other' = 'Other'
    
    if (title.startsWith('SAT')) {
      if (title.includes('International') || title.includes('US')) {
        examType = 'fullTest'
        region = title.includes('International') ? 'International' : 'US'
      } else if (title.includes('English') || title.includes('Math')) {
        examType = 'sectionExam'
      }
    } else {
      // Individual modules
      if (title.includes('International')) {
        region = 'International'
      } else if (title.includes('US')) {
        region = 'US'
      }
    }
    
    return { date, examType, region }
  }

  const groupExamsByCategory = (exams: ExamWithCurves[]) => {
    const grouped: Record<string, {
      fullTest: ExamWithCurves[]
      sectionExam: ExamWithCurves[]
      individualModule: {
        International: ExamWithCurves[]
        US: ExamWithCurves[]
        Other: ExamWithCurves[]
      }
    }> = {}
    
    exams.forEach(exam => {
      const { date, examType, region } = parseExamTitle(exam.title)
      
      if (!grouped[date]) {
        grouped[date] = {
          fullTest: [],
          sectionExam: [],
          individualModule: {
            International: [],
            US: [],
            Other: []
          }
        }
      }
      
      if (examType === 'fullTest') {
        grouped[date].fullTest.push(exam)
      } else if (examType === 'sectionExam') {
        grouped[date].sectionExam.push(exam)
      } else {
        grouped[date].individualModule[region].push(exam)
      }
    })
    
    return grouped
  }

  const toggleDateGroup = (date: string) => {
    const newExpanded = new Set(expandedDateGroups)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDateGroups(newExpanded)
  }

  const toggleTestType = (key: string) => {
    const newExpanded = new Set(expandedTestTypes)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedTestTypes(newExpanded)
  }

  const toggleRegion = (key: string) => {
    const newExpanded = new Set(expandedRegions)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRegions(newExpanded)
  }

  const renderGroupedExams = () => {
    const groupedExams = groupExamsByCategory(filteredExams)
    const sortedDates = Object.keys(groupedExams).sort((a, b) => {
      // Sort by year first, then by month
      const [yearA, monthA] = a.split(' ')
      const [yearB, monthB] = b.split(' ')
      if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA)
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
      return months.indexOf(monthB) - months.indexOf(monthA)
    })
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-8"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-64">Exam</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24">Created</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">English Curve</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">Math Curve</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">Answer Visibility</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDates.map(date => {
              const dateGroup = groupedExams[date]
              const isDateExpanded = expandedDateGroups.has(date)
              
              return (
                <React.Fragment key={date}>
                  {/* Date Group Header */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td colSpan={7} className="px-3 py-2">
                      <button
                        onClick={() => toggleDateGroup(date)}
                        className="flex items-center space-x-2 font-medium text-gray-800 hover:text-gray-900"
                      >
                        <span className="text-gray-500">
                          {isDateExpanded ? '▼' : '▶'}
                        </span>
                        <span>{date}</span>
                      </button>
                    </td>
                  </tr>
                  
                  {isDateExpanded && (
                    <>
                      {/* Full Test Section */}
                      {dateGroup.fullTest.length > 0 && (
                        <>
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${date}-fullTest`)}
                                className="flex items-center space-x-2 text-sm font-medium text-blue-800 hover:text-blue-900"
                              >
                                <span className="text-blue-600 text-xs">
                                  {expandedTestTypes.has(`${date}-fullTest`) ? '▼' : '▶'}
                                </span>
                                <span>Full Test ({dateGroup.fullTest.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${date}-fullTest`) &&
                            dateGroup.fullTest.map(exam => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                              />
                            ))
                          }
                        </>
                      )}
                      
                      {/* Section Exam */}
                      {dateGroup.sectionExam.length > 0 && (
                        <>
                          <tr className="bg-green-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${date}-sectionExam`)}
                                className="flex items-center space-x-2 text-sm font-medium text-green-800 hover:text-green-900"
                              >
                                <span className="text-green-600 text-xs">
                                  {expandedTestTypes.has(`${date}-sectionExam`) ? '▼' : '▶'}
                                </span>
                                <span>Section Exam ({dateGroup.sectionExam.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${date}-sectionExam`) &&
                            dateGroup.sectionExam.map(exam => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                              />
                            ))
                          }
                        </>
                      )}
                      
                      {/* Individual Modules */}
                      {(dateGroup.individualModule.International.length > 0 ||
                        dateGroup.individualModule.US.length > 0 ||
                        dateGroup.individualModule.Other.length > 0) && (
                        <>
                          <tr className="bg-purple-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${date}-individualModule`)}
                                className="flex items-center space-x-2 text-sm font-medium text-purple-800 hover:text-purple-900"
                              >
                                <span className="text-purple-600 text-xs">
                                  {expandedTestTypes.has(`${date}-individualModule`) ? '▼' : '▶'}
                                </span>
                                <span>Individual Modules ({
                                  dateGroup.individualModule.International.length +
                                  dateGroup.individualModule.US.length +
                                  dateGroup.individualModule.Other.length
                                })</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${date}-individualModule`) && (
                            <>
                              {/* International Modules */}
                              {dateGroup.individualModule.International.length > 0 && (
                                <>
                                  <tr className="bg-orange-50">
                                    <td colSpan={7} className="px-9 py-1">
                                      <button
                                        onClick={() => toggleRegion(`${date}-International`)}
                                        className="flex items-center space-x-2 text-sm font-medium text-orange-800 hover:text-orange-900"
                                      >
                                        <span className="text-orange-600 text-xs">
                                          {expandedRegions.has(`${date}-International`) ? '▼' : '▶'}
                                        </span>
                                        <span>International ({dateGroup.individualModule.International.length})</span>
                                      </button>
                                    </td>
                                  </tr>
                                  {expandedRegions.has(`${date}-International`) &&
                                    dateGroup.individualModule.International.map(exam => (
                                      <ExamRow
                                        key={exam.id}
                                        exam={exam}
                                        openAnswerModal={openAnswerModal}
                                        onExamDeleted={fetchExamsOptimized}
                                      />
                                    ))
                                  }
                                </>
                              )}
                              
                              {/* US Modules */}
                              {dateGroup.individualModule.US.length > 0 && (
                                <>
                                  <tr className="bg-red-50">
                                    <td colSpan={7} className="px-9 py-1">
                                      <button
                                        onClick={() => toggleRegion(`${date}-US`)}
                                        className="flex items-center space-x-2 text-sm font-medium text-red-800 hover:text-red-900"
                                      >
                                        <span className="text-red-600 text-xs">
                                          {expandedRegions.has(`${date}-US`) ? '▼' : '▶'}
                                        </span>
                                        <span>US ({dateGroup.individualModule.US.length})</span>
                                      </button>
                                    </td>
                                  </tr>
                                  {expandedRegions.has(`${date}-US`) &&
                                    dateGroup.individualModule.US.map(exam => (
                                      <ExamRow
                                        key={exam.id}
                                        exam={exam}
                                        openAnswerModal={openAnswerModal}
                                        onExamDeleted={fetchExamsOptimized}
                                      />
                                    ))
                                  }
                                </>
                              )}
                              
                              {/* Other Modules */}
                              {dateGroup.individualModule.Other.length > 0 && (
                                <>
                                  <tr className="bg-gray-50">
                                    <td colSpan={7} className="px-9 py-1">
                                      <button
                                        onClick={() => toggleRegion(`${date}-Other`)}
                                        className="flex items-center space-x-2 text-sm font-medium text-gray-800 hover:text-gray-900"
                                      >
                                        <span className="text-gray-600 text-xs">
                                          {expandedRegions.has(`${date}-Other`) ? '▼' : '▶'}
                                        </span>
                                        <span>Other ({dateGroup.individualModule.Other.length})</span>
                                      </button>
                                    </td>
                                  </tr>
                                  {expandedRegions.has(`${date}-Other`) &&
                                    dateGroup.individualModule.Other.map(exam => (
                                      <ExamRow
                                        key={exam.id}
                                        exam={exam}
                                        openAnswerModal={openAnswerModal}
                                        onExamDeleted={fetchExamsOptimized}
                                      />
                                    ))
                                  }
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const handleExamCreated = (newExamId: string) => {
    setIsCreateModalOpen(false)
    router.push(`/admin/exams/${newExamId}/settings`)
  }

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading exams...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Exam Management
            </h1>
            <p className="text-gray-600">View and manage all available exams</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              ＋ New Exam
            </Button>
            <Link href="/admin/exams/create">
              <Button
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                ＋ New from Template
              </Button>
            </Link>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Grouped Exams Display */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Exams</h2>
          </div>

          {filteredExams.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">
                {searchTerm
                  ? 'No exams match your search criteria.'
                  : 'No exams found.'}
              </p>
            </div>
          ) : (
            <div className="p-6">
              {renderGroupedExams()}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {filteredExams.length}
            </div>
            <div className="text-sm text-gray-600">
              {searchTerm ? 'Filtered Exams' : 'Total Exams'}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {
                filteredExams.filter(
                  (e) => e.english_curve_name && e.math_curve_name
                ).length
              }
            </div>
            <div className="text-sm text-gray-600">Fully Configured</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-orange-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {
                filteredExams.filter(
                  (e) => !e.english_curve_name || !e.math_curve_name
                ).length
              }
            </div>
            <div className="text-sm text-gray-600">Need Configuration</div>
          </div>
        </div>
      </div>

      <AnswerReleaseModal
        isOpen={modalState.isOpen}
        onClose={closeAnswerModal}
        examId={modalState.examId}
        examTitle={modalState.examTitle}
        onConfirm={handleAnswerVisibilityUpdate}
      />

      <CreateExamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onExamCreated={handleExamCreated}
      />
    </div>
  )
}
