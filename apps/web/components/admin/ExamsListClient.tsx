'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AnswerReleaseModal from '@/components/admin/AnswerReleaseModal'
import { ExamRow } from './ExamRow'
import { Button } from '@/components/ui/button'
import { CreateExamModal } from './CreateExamModal'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { useCachedData } from '@/lib/hooks/use-cached-data'
import { LoadingOverlay } from '@/components/ui/loading-overlay'

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
  is_custom_assignment: boolean
  exam_type: 'template' | 'custom' | 'original'
  default_answers_visible: boolean
  default_answers_visible_after: string | null
}

// Transformed interface for UI consumption
interface ExamWithCurves {
  id: string
  title: string
  description: string
  created_at: string
  is_active: boolean
  total_questions: number
  total_attempts_count: number
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
  english_curve_name: string | null
  math_curve_name: string | null
  template_id: string | null
  is_custom_assignment: boolean
  exam_type: 'template' | 'custom' | 'original'
  scoring_groups?: { [key: string]: string[] }
  answer_release_setting?: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

const MONTH_DEFINITIONS = [
  { label: 'January', variants: ['january', 'jan'] },
  { label: 'February', variants: ['february', 'feb'] },
  { label: 'March', variants: ['march', 'mar'] },
  { label: 'April', variants: ['april', 'apr'] },
  { label: 'May', variants: ['may'] },
  { label: 'June', variants: ['june', 'jun'] },
  { label: 'July', variants: ['july', 'jul'] },
  { label: 'August', variants: ['august', 'aug'] },
  { label: 'September', variants: ['september', 'sept', 'sep'] },
  { label: 'October', variants: ['october', 'oct'] },
  { label: 'November', variants: ['november', 'nov'] },
  { label: 'December', variants: ['december', 'dec'] },
] as const

const MONTH_LABELS = MONTH_DEFINITIONS.map((definition) => definition.label)

type ExamFormat = 'fullTest' | 'sectionExam' | 'individualModule' | 'custom' | 'other'
type ExamOrigin = 'template' | 'custom' | 'original'
type ExamRegion = 'International' | 'US' | 'Digital' | 'Other'
type SortOption = 'recent' | 'oldest' | 'title'

interface ExamMeta {
  format: ExamFormat
  origin: ExamOrigin
  region: ExamRegion
  monthIndex: number | null
  year: number | null
  tags: string[]
}

interface ExamWithMeta {
  exam: ExamWithCurves
  meta: ExamMeta
}

interface ExamGroupBucket {
  fullTest: ExamWithMeta[]
  sectionExam: ExamWithMeta[]
  individualModule: Record<ExamRegion, ExamWithMeta[]>
  custom: ExamWithMeta[]
  other: ExamWithMeta[]
}

type ExamGroupType = 'date' | 'custom' | 'other'

interface ExamGroup {
  key: string
  label: string
  type: ExamGroupType
  year?: number
  monthIndex?: number
  buckets: ExamGroupBucket
}

const REGION_OPTIONS: { key: ExamRegion; label: string }[] = [
  { key: 'International', label: 'International' },
  { key: 'US', label: 'US' },
  { key: 'Digital', label: 'Digital' },
  { key: 'Other', label: 'Other' },
]

const FORMAT_OPTIONS: { key: ExamFormat; label: string }[] = [
  { key: 'fullTest', label: 'Full Tests' },
  { key: 'sectionExam', label: 'Sections' },
  { key: 'individualModule', label: 'Modules' },
  { key: 'custom', label: 'Custom Assignments' },
  { key: 'other', label: 'Other' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
]

const REGION_ORDER: ExamRegion[] = ['International', 'US', 'Digital', 'Other']

const REGION_STYLE: Record<ExamRegion, { rowClass: string; buttonClass: string; iconClass: string }> = {
  International: {
    rowClass: 'bg-orange-50',
    buttonClass: 'text-orange-800 hover:text-orange-900',
    iconClass: 'text-orange-600',
  },
  US: {
    rowClass: 'bg-emerald-50',
    buttonClass: 'text-emerald-800 hover:text-emerald-900',
    iconClass: 'text-emerald-600',
  },
  Digital: {
    rowClass: 'bg-sky-50',
    buttonClass: 'text-sky-800 hover:text-sky-900',
    iconClass: 'text-sky-600',
  },
  Other: {
    rowClass: 'bg-gray-50',
    buttonClass: 'text-gray-800 hover:text-gray-900',
    iconClass: 'text-gray-600',
  },
}

const monthMatchers = MONTH_DEFINITIONS.map((definition) => ({
  label: definition.label,
  regexes: definition.variants.map(
    (variant) => new RegExp(`\\b${variant.replace('.', '\\.')}\\b`, 'i')
  ),
}))

const yearRegex = /\b(20[0-9]{2})\b/

const detectMonthIndex = (title: string): number | null => {
  for (let index = 0; index < monthMatchers.length; index += 1) {
    const { regexes } = monthMatchers[index]
    if (regexes.some((regex) => regex.test(title))) {
      return index
    }
  }
  return null
}

const detectYear = (title: string): number | null => {
  const match = title.match(yearRegex)
  return match ? Number(match[1]) : null
}

const deriveExamMetadata = (exam: ExamWithCurves): ExamMeta => {
  const normalizedTitle = exam.title.toLowerCase()

  let format: ExamFormat = 'other'
  if (exam.is_custom_assignment || exam.exam_type === 'custom') {
    format = 'custom'
  } else if (/\bmodule\b/.test(normalizedTitle)) {
    format = 'individualModule'
  } else if (
    /\bsection\b/.test(normalizedTitle) ||
    (/\b(english|reading|writing|math)\b/.test(normalizedTitle) && /\bsat\b/.test(normalizedTitle))
  ) {
    format = 'sectionExam'
  } else if (normalizedTitle.startsWith('sat') || /\bsat\b/.test(normalizedTitle)) {
    format = 'fullTest'
  }

  let origin: ExamOrigin = exam.exam_type
  if (exam.is_custom_assignment) {
    origin = 'custom'
  }

  let region: ExamRegion = 'Other'
  if (/\binternational\b/.test(normalizedTitle)) {
    region = 'International'
  } else if (/\bschool day\b/.test(normalizedTitle)) {
    region = 'US'
  } else if (/\bdigital\b/.test(normalizedTitle)) {
    region = 'Digital'
  } else if (/\b(us|usa)\b/.test(normalizedTitle)) {
    region = 'US'
  }

  const isCustom = origin === 'custom' || format === 'custom'
  const monthIndex = isCustom ? null : detectMonthIndex(normalizedTitle)
  let year = isCustom ? null : detectYear(normalizedTitle)

  if (!isCustom && monthIndex !== null && year === null) {
    year = new Date(exam.created_at).getFullYear()
  }

  const tags: string[] = []
  if (exam.is_active) {
    tags.push('active')
  }
  if (exam.total_attempts_count > 0) {
    tags.push('hasAttempts')
  }
  if (exam.total_questions > 0) {
    tags.push('hasQuestions')
  }
  if (exam.english_curve_name && exam.math_curve_name) {
    tags.push('fullyConfigured')
  }

  return {
    format,
    origin,
    region,
    monthIndex,
    year,
    tags,
  }
}

const createEmptyBucket = (): ExamGroupBucket => ({
  fullTest: [],
  sectionExam: [],
  individualModule: {
    International: [],
    US: [],
    Digital: [],
    Other: [],
  },
  custom: [],
  other: [],
})

const groupExamsByCategory = (exams: ExamWithMeta[]): ExamGroup[] => {
  const groupsMap = new Map<string, ExamGroup>()

  exams.forEach((entry) => {
    const { exam, meta } = entry

    let key: string
    let label: string
    let type: ExamGroupType
    let year: number | undefined
    let monthIndex: number | undefined

    if (meta.format === 'custom' || meta.origin === 'custom') {
      key = 'custom'
      label = 'Custom Assignments'
      type = 'custom'
    } else if (meta.monthIndex !== null && meta.year !== null) {
      key = `date-${meta.year}-${meta.monthIndex}`
      label = `${meta.year} • ${MONTH_LABELS[meta.monthIndex]}`
      type = 'date'
      year = meta.year
      monthIndex = meta.monthIndex
    } else {
      key = 'other'
      label = 'Other Exams'
      type = 'other'
    }

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        label,
        type,
        year,
        monthIndex,
        buckets: createEmptyBucket(),
      })
    }

    const group = groupsMap.get(key)!
    switch (meta.format) {
      case 'fullTest':
        group.buckets.fullTest.push(entry)
        break
      case 'sectionExam':
        group.buckets.sectionExam.push(entry)
        break
      case 'individualModule':
        group.buckets.individualModule[meta.region].push(entry)
        break
      case 'custom':
        group.buckets.custom.push(entry)
        break
      default:
        group.buckets.other.push(entry)
    }
  })

  return Array.from(groupsMap.values())
}

const sortExamEntries = (entries: ExamWithMeta[], sortBy: SortOption) => {
  entries.sort((a, b) => {
    if (sortBy === 'title') {
      return a.exam.title.localeCompare(b.exam.title, undefined, {
        sensitivity: 'base',
      })
    }

    const timeA = new Date(a.exam.created_at).getTime()
    const timeB = new Date(b.exam.created_at).getTime()

    if (sortBy === 'oldest') {
      return timeA - timeB
    }

    return timeB - timeA
  })
}

const sortExamGroups = (groups: ExamGroup[], sortBy: SortOption): ExamGroup[] => {
  groups.forEach((group) => {
    sortExamEntries(group.buckets.fullTest, sortBy)
    sortExamEntries(group.buckets.sectionExam, sortBy)
    REGION_ORDER.forEach((region) => {
      sortExamEntries(group.buckets.individualModule[region], sortBy)
    })
    sortExamEntries(group.buckets.custom, sortBy)
    sortExamEntries(group.buckets.other, sortBy)
  })

  const sorted = [...groups]
  if (sortBy === 'title') {
    sorted.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return sorted
  }

  sorted.sort((a, b) => {
    if (a.type === 'date' && b.type === 'date') {
      if (a.year !== b.year) {
        if (sortBy === 'oldest') {
          return (a.year ?? 0) - (b.year ?? 0)
        }
        return (b.year ?? 0) - (a.year ?? 0)
      }
      if (a.monthIndex !== b.monthIndex) {
        if (sortBy === 'oldest') {
          return (a.monthIndex ?? 0) - (b.monthIndex ?? 0)
        }
        return (b.monthIndex ?? 0) - (a.monthIndex ?? 0)
      }
      return 0
    }

    if (a.type === 'date') {
      return -1
    }
    if (b.type === 'date') {
      return 1
    }

    const rank = (group: ExamGroup) => {
      if (group.type === 'custom') return 1
      return 2
    }

    if (sortBy === 'oldest') {
      return rank(a) - rank(b)
    }
    return rank(a) - rank(b)
  })

  return sorted
}

export function ExamsListClient() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()

  // Template data with caching
  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_templates')
      .select('id, scoring_groups')

    if (error) {
      console.error('Error fetching templates:', error)
      return {}
    }

    const templatesMap: {
      [key: string]: { scoring_groups: { [key: string]: string[] } }
    } = {}
    data?.forEach((template) => {
      templatesMap[template.id] = {
        scoring_groups: template.scoring_groups || {},
      }
    })
    return templatesMap
  }, [])

  const {
    data: templates,
    refresh: refreshTemplates,
  } = useCachedData(fetchTemplates, {
    key: 'admin-templates',
    ttl: 10 * 60 * 1000,
  }) // 10 minutes cache

  // Exam data with caching
  const fetchExams = useCallback(async () => {
    if (!templates) return []

    const { data: rpcData, error } = await supabase.rpc('get_admin_exams_list')

    if (error) {
      console.error('Error fetching exams:', error)
      return []
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
          is_active: exam.is_active,
          total_questions: exam.total_questions,
          total_attempts_count: exam.total_attempts_count,
          english_scoring_curve_id: exam.english_curve_id,
          math_scoring_curve_id: exam.math_curve_id,
          english_curve_name: exam.english_curve_name,
          math_curve_name: exam.math_curve_name,
          template_id: exam.template_id,
          is_custom_assignment: exam.is_custom_assignment,
          exam_type: exam.exam_type,
          scoring_groups: exam.template_id
            ? templates[exam.template_id]?.scoring_groups
            : undefined,
          answer_release_setting: answerReleaseSetting,
        }
      }
    )

    return transformedData
  }, [templates])

  const {
    data: exams,
    loading,
    refresh: refreshExams,
  } = useCachedData(fetchExams, {
    key: 'admin-exams',
    ttl: 2 * 60 * 1000,
  }) // 2 minutes cache

  // Ensure exams refresh once template data resolves so we don't cache an empty list
  useEffect(() => {
    if (!templates) return
    refreshExams()
  }, [templates, refreshExams])

  const [filteredExams, setFilteredExams] = useState<ExamWithCurves[]>([])
  const [searchTerm, setSearchTerm] = usePersistentState('admin-exams-search', '')
  const [expandedDateGroups, setExpandedDateGroups] = usePersistentState<Set<string>>(
    'admin-exams-expanded-dates',
    new Set()
  )
  const [expandedTestTypes, setExpandedTestTypes] = usePersistentState<Set<string>>(
    'admin-exams-expanded-types',
    new Set()
  )
  const [expandedRegions, setExpandedRegions] = usePersistentState<Set<string>>(
    'admin-exams-expanded-regions',
    new Set()
  )
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

  const [selectedFormats, setSelectedFormats] = usePersistentState<Set<ExamFormat>>(
    'admin-exams-format-filters',
    new Set()
  )
  const [selectedRegions, setSelectedRegions] = usePersistentState<Set<ExamRegion>>(
    'admin-exams-region-filters',
    new Set()
  )
  const [showActiveOnly, setShowActiveOnly] = usePersistentState<boolean>(
    'admin-exams-active-only',
    false
  )
  const [sortBy, setSortBy] = usePersistentState<SortOption>(
    'admin-exams-sort',
    'recent'
  )

  const examsWithMeta = useMemo<ExamWithMeta[]>(() => {
    return filteredExams.map((exam) => ({
      exam,
      meta: deriveExamMetadata(exam),
    }))
  }, [filteredExams])

  const displayedExamsWithMeta = useMemo<ExamWithMeta[]>(() => {
    return examsWithMeta.filter(({ exam, meta }) => {
      if (showActiveOnly && !exam.is_active) {
        return false
      }
      if (selectedFormats.size > 0 && !selectedFormats.has(meta.format)) {
        return false
      }
      if (selectedRegions.size > 0 && !selectedRegions.has(meta.region)) {
        return false
      }
      return true
    })
  }, [examsWithMeta, selectedFormats, selectedRegions, showActiveOnly])

  const displayedExams = useMemo(() => {
    return displayedExamsWithMeta.map(({ exam }) => exam)
  }, [displayedExamsWithMeta])

  const groupedExamGroups = useMemo(() => {
    return sortExamGroups(groupExamsByCategory(displayedExamsWithMeta), sortBy)
  }, [displayedExamsWithMeta, sortBy])

  const hasFormatFilter = selectedFormats.size > 0
  const hasRegionFilter = selectedRegions.size > 0
  const hasSearch = searchTerm.trim().length > 0
  const hasFilters = hasFormatFilter || hasRegionFilter || showActiveOnly || sortBy !== 'recent'

  const fullyConfiguredCount = useMemo(() => {
    return displayedExams.filter(
      (exam) => exam.english_curve_name && exam.math_curve_name
    ).length
  }, [displayedExams])

  const needsConfigurationCount = displayedExams.length - fullyConfiguredCount

  const totalExamCount = exams?.length ?? 0
  const emptyStateMessage = hasSearch || hasFilters
    ? 'No exams match your current search or filters.'
    : 'No exams found.'

  // Create a refresh function for the exam data after updates
  const fetchExamsOptimized = useCallback(async () => {
    await refreshExams()
  }, [refreshExams])

  // Apply filtering when data or search changes
  useEffect(() => {
    if (!exams) return

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

  // Initialize all groups as expanded when exams are loaded (only if no previous state exists)
  useEffect(() => {
    if (
      groupedExamGroups.length > 0 &&
      !allGroupsInitialized &&
      expandedDateGroups.size === 0
    ) {
      const dateGroups = new Set<string>()
      const testTypeGroups = new Set<string>()
      const regionGroups = new Set<string>()

      groupedExamGroups.forEach((group) => {
        dateGroups.add(group.key)

        if (group.buckets.fullTest.length > 0) {
          testTypeGroups.add(`${group.key}-fullTest`)
        }
        if (group.buckets.sectionExam.length > 0) {
          testTypeGroups.add(`${group.key}-sectionExam`)
        }
        const hasModules = REGION_ORDER.some(
          (region) => group.buckets.individualModule[region].length > 0
        )
        if (hasModules) {
          testTypeGroups.add(`${group.key}-individualModule`)
        }
        if (group.buckets.custom.length > 0) {
          testTypeGroups.add(`${group.key}-custom`)
        }
        if (group.buckets.other.length > 0) {
          testTypeGroups.add(`${group.key}-other`)
        }

        REGION_ORDER.forEach((region) => {
          if (group.buckets.individualModule[region].length > 0) {
            regionGroups.add(`${group.key}-${region}`)
          }
        })
      })

      setExpandedDateGroups(dateGroups)
      setExpandedTestTypes(testTypeGroups)
      setExpandedRegions(regionGroups)
    }

    if (groupedExamGroups.length > 0) {
      setAllGroupsInitialized(true)
    }
  }, [
    groupedExamGroups,
    allGroupsInitialized,
    expandedDateGroups.size,
    setExpandedDateGroups,
    setExpandedTestTypes,
    setExpandedRegions,
  ])

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
      await refreshExams()
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

  const toggleFormatFilter = (format: ExamFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev)
      if (next.has(format)) {
        next.delete(format)
      } else {
        next.add(format)
      }
      return next
    })
  }

  const toggleRegionFilter = (region: ExamRegion) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(region)) {
        next.delete(region)
      } else {
        next.add(region)
      }
      return next
    })
  }

  const resetFilters = () => {
    setSelectedFormats(() => new Set<ExamFormat>())
    setSelectedRegions(() => new Set<ExamRegion>())
    setShowActiveOnly(false)
    setSortBy('recent')
  }

  const getFilterChipClasses = (isActive: boolean) =>
    isActive
      ? 'px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-medium shadow-sm border border-purple-600'
      : 'px-3 py-1 rounded-full border border-gray-300 text-xs font-medium text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors'

  const renderGroupedExams = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-8"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-64">
                Exam
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                Created
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">
                English Curve
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">
                Math Curve
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">
                Answer Visibility
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedExamGroups.map((group) => {
              const isGroupExpanded = expandedDateGroups.has(group.key)
              const modulesCount = REGION_ORDER.reduce(
                (acc, region) => acc + group.buckets.individualModule[region].length,
                0
              )

              return (
                <React.Fragment key={group.key}>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td colSpan={7} className="px-3 py-2">
                      <button
                        onClick={() => toggleDateGroup(group.key)}
                        className="flex items-center space-x-2 font-medium text-gray-800 hover:text-gray-900"
                      >
                        <span className="text-gray-500">
                          {isGroupExpanded ? '▼' : '▶'}
                        </span>
                        <span>{group.label}</span>
                      </button>
                    </td>
                  </tr>

                  {isGroupExpanded && (
                    <>
                      {group.buckets.fullTest.length > 0 && (
                        <>
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${group.key}-fullTest`)}
                                className="flex items-center space-x-2 text-sm font-medium text-blue-800 hover:text-blue-900"
                              >
                                <span className="text-blue-600 text-xs">
                                  {expandedTestTypes.has(`${group.key}-fullTest`)
                                    ? '▼'
                                    : '▶'}
                                </span>
                                <span>Full Tests ({group.buckets.fullTest.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${group.key}-fullTest`) &&
                            group.buckets.fullTest.map(({ exam }) => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                                onExamUpdated={fetchExamsOptimized}
                              />
                            ))}
                        </>
                      )}

                      {group.buckets.sectionExam.length > 0 && (
                        <>
                          <tr className="bg-green-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${group.key}-sectionExam`)}
                                className="flex items-center space-x-2 text-sm font-medium text-green-800 hover:text-green-900"
                              >
                                <span className="text-green-600 text-xs">
                                  {expandedTestTypes.has(`${group.key}-sectionExam`)
                                    ? '▼'
                                    : '▶'}
                                </span>
                                <span>Sections ({group.buckets.sectionExam.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${group.key}-sectionExam`) &&
                            group.buckets.sectionExam.map(({ exam }) => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                                onExamUpdated={fetchExamsOptimized}
                              />
                            ))}
                        </>
                      )}

                      {modulesCount > 0 && (
                        <>
                          <tr className="bg-purple-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${group.key}-individualModule`)}
                                className="flex items-center space-x-2 text-sm font-medium text-purple-800 hover:text-purple-900"
                              >
                                <span className="text-purple-600 text-xs">
                                  {expandedTestTypes.has(`${group.key}-individualModule`)
                                    ? '▼'
                                    : '▶'}
                                </span>
                                <span>Modules ({modulesCount})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${group.key}-individualModule`) && (
                            <>
                              {REGION_ORDER.map((region) => {
                                const regionEntries = group.buckets.individualModule[region]
                                if (regionEntries.length === 0) {
                                  return null
                                }

                                const regionKey = `${group.key}-${region}`
                                const { rowClass, buttonClass, iconClass } = REGION_STYLE[region]

                                return (
                                  <React.Fragment key={region}>
                                    <tr className={rowClass}>
                                      <td colSpan={7} className="px-9 py-1">
                                        <button
                                          onClick={() => toggleRegion(regionKey)}
                                          className={`flex items-center space-x-2 text-sm font-medium ${buttonClass}`}
                                        >
                                          <span className={`${iconClass} text-xs`}>
                                            {expandedRegions.has(regionKey) ? '▼' : '▶'}
                                          </span>
                                          <span>
                                            {region} ({regionEntries.length})
                                          </span>
                                        </button>
                                      </td>
                                    </tr>
                                    {expandedRegions.has(regionKey) &&
                                      regionEntries.map(({ exam }) => (
                                        <ExamRow
                                          key={exam.id}
                                          exam={exam}
                                          openAnswerModal={openAnswerModal}
                                          onExamDeleted={fetchExamsOptimized}
                                          onExamUpdated={fetchExamsOptimized}
                                        />
                                      ))}
                                  </React.Fragment>
                                )
                              })}
                            </>
                          )}
                        </>
                      )}

                      {group.buckets.custom.length > 0 && (
                        <>
                          <tr className="bg-rose-50">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${group.key}-custom`)}
                                className="flex items-center space-x-2 text-sm font-medium text-rose-800 hover:text-rose-900"
                              >
                                <span className="text-rose-600 text-xs">
                                  {expandedTestTypes.has(`${group.key}-custom`)
                                    ? '▼'
                                    : '▶'}
                                </span>
                                <span>Custom Assignments ({group.buckets.custom.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${group.key}-custom`) &&
                            group.buckets.custom.map(({ exam }) => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                                onExamUpdated={fetchExamsOptimized}
                              />
                            ))}
                        </>
                      )}

                      {group.buckets.other.length > 0 && (
                        <>
                          <tr className="bg-slate-100">
                            <td colSpan={7} className="px-6 py-1">
                              <button
                                onClick={() => toggleTestType(`${group.key}-other`)}
                                className="flex items-center space-x-2 text-sm font-medium text-slate-800 hover:text-slate-900"
                              >
                                <span className="text-slate-600 text-xs">
                                  {expandedTestTypes.has(`${group.key}-other`)
                                    ? '▼'
                                    : '▶'}
                                </span>
                                <span>Other ({group.buckets.other.length})</span>
                              </button>
                            </td>
                          </tr>
                          {expandedTestTypes.has(`${group.key}-other`) &&
                            group.buckets.other.map(({ exam }) => (
                              <ExamRow
                                key={exam.id}
                                exam={exam}
                                openAnswerModal={openAnswerModal}
                                onExamDeleted={fetchExamsOptimized}
                                onExamUpdated={fetchExamsOptimized}
                              />
                            ))}
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

  if (authLoading || loading || !exams) {
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
    <>
      <LoadingOverlay isVisible={loading} message="Refreshing data..." />
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

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <input
              type="text"
              placeholder="Search exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Format
              </span>
              <button
                type="button"
                onClick={() => setSelectedFormats(() => new Set<ExamFormat>())}
                className={getFilterChipClasses(!hasFormatFilter)}
              >
                All
              </button>
              {FORMAT_OPTIONS.map((option) => {
                const isActive = selectedFormats.has(option.key)
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleFormatFilter(option.key)}
                    className={getFilterChipClasses(isActive)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Region
              </span>
              <button
                type="button"
                onClick={() => setSelectedRegions(() => new Set<ExamRegion>())}
                className={getFilterChipClasses(!hasRegionFilter)}
              >
                All
              </button>
              {REGION_OPTIONS.map((option) => {
                const isActive = selectedRegions.has(option.key)
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleRegionFilter(option.key)}
                    className={getFilterChipClasses(isActive)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                  <span>Active only</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="admin-exams-sort" className="text-sm text-gray-600">
                  Sort
                </label>
                <select
                  id="admin-exams-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasFilters}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Grouped Exams Display */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Exams</h2>
          </div>

          {displayedExamsWithMeta.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">{emptyStateMessage}</p>
              {(hasSearch || hasFilters) && (
                <p className="mt-2 text-sm text-gray-400">
                  Try adjusting your filters or search terms.
                </p>
              )}
              {hasFilters && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md shadow hover:bg-purple-700"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">{renderGroupedExams()}</div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {displayedExams.length}
            </div>
            <div className="text-sm text-gray-600">
              {hasSearch || hasFilters ? 'Visible Exams' : 'Total Exams'}
              {hasSearch || hasFilters ? (
                <span className="block text-xs text-gray-400">
                  Showing {displayedExams.length} of {totalExamCount}
                </span>
              ) : null}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {fullyConfiguredCount}
            </div>
            <div className="text-sm text-gray-600">Fully Configured</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-orange-100 p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {needsConfigurationCount}
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
    </>
  )
}
