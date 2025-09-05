'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { createExamFromModules } from '@/lib/exam-actions'
import { toast } from 'sonner'

interface ExamTemplate {
  id: string
  name: string
  description: string
  scoring_groups: Record<string, string[]>
}

interface ImportedModule {
  id: string
  title: string
  module_composition: Record<string, any>
}

export function CreateExamClient() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [allTemplates, setAllTemplates] = useState<ExamTemplate[]>([])
  const [allImportedModules, setAllImportedModules] = useState<ImportedModule[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [moduleAssignments, setModuleAssignments] = useState<Record<string, string>>({})
  const [isCreating, setIsCreating] = useState(false)

  // Fetch templates and modules
  useEffect(() => {
    if (user && isAdmin) {
      fetchTemplatesAndModules()
    }
  }, [user, isAdmin])

  const fetchTemplatesAndModules = async () => {
    setLoading(true)
    try {
      const [templatesResult, modulesResult] = await Promise.all([
        supabase
          .from('exam_templates')
          .select('*')
          .order('name'),
        supabase
          .from('exams')
          .select('id, title, module_composition')
          .eq('is_module_source', true)
          .order('title')
      ])

      if (templatesResult.error) {
        console.error('Error fetching templates:', templatesResult.error)
        toast.error('Failed to fetch templates')
        return
      }

      if (modulesResult.error) {
        console.error('Error fetching imported modules:', modulesResult.error)
        toast.error('Failed to fetch imported modules')
        return
      }

      setAllTemplates(templatesResult.data || [])
      setAllImportedModules(modulesResult.data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('An error occurred while fetching data')
    } finally {
      setLoading(false)
    }
  }

  const selectedTemplate = selectedTemplateId 
    ? allTemplates.find(t => t.id === selectedTemplateId)
    : null

  const getCompatibleModules = (moduleType: string) => {
    return allImportedModules.filter(module => {
      if (!module.module_composition) return false
      // Check if the module_composition has the required module type set to true
      return module.module_composition[moduleType] === true
    })
  }

  const getRequiredModuleSlots = () => {
    if (!selectedTemplate) return []
    
    const slots: string[] = []
    Object.values(selectedTemplate.scoring_groups).forEach(moduleTypes => {
      slots.push(...moduleTypes)
    })
    return slots
  }

  const areAllSlotsAssigned = () => {
    const requiredSlots = getRequiredModuleSlots()
    return requiredSlots.every(slot => moduleAssignments[slot])
  }

  const canCreateExam = () => {
    return title.trim() && selectedTemplateId && areAllSlotsAssigned()
  }

  const handleCreateExam = async () => {
    if (!canCreateExam() || !selectedTemplateId) return

    setIsCreating(true)
    try {
      const result = await createExamFromModules({
        title: title.trim(),
        description: description.trim(),
        templateId: selectedTemplateId,
        moduleAssignments
      })

      if (result.success) {
        toast.success('Exam created successfully!')
        router.push('/admin/exams')
      } else {
        toast.error(result.error || 'Failed to create exam')
      }
    } catch (error) {
      console.error('Error creating exam:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  const formatModuleSlotName = (moduleType: string) => {
    const parts = moduleType.split(/(\d+)/)
    if (parts.length >= 3) {
      const subject = parts[0]
      const number = parts[1]
      return `${subject.charAt(0).toUpperCase() + subject.slice(1)} Module ${number}`
    }
    return moduleType.charAt(0).toUpperCase() + moduleType.slice(1)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Loading exam templates...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="text-center min-h-[400px] flex items-center justify-center">
        <div>
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
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Exam</h1>
        <p className="text-gray-600 mt-2">
          Build a new exam by selecting a template and assigning modules
        </p>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Basic Information & Template Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Exam Title *</Label>
            <Input
              id="title"
              placeholder="Enter exam title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter exam description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Exam Template *</Label>
            <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || undefined}>
              <SelectTrigger>
                <SelectValue placeholder="Select an exam template..." />
              </SelectTrigger>
              <SelectContent>
                {allTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-gray-500">{template.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Module Assignment</CardTitle>
            <p className="text-sm text-gray-600">
              Assign imported modules to each required slot for the selected template
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {getRequiredModuleSlots().map((moduleType) => {
              const compatibleModules = getCompatibleModules(moduleType)
              
              return (
                <div key={moduleType} className="space-y-2">
                  <Label>{formatModuleSlotName(moduleType)} Slot *</Label>
                  <Select 
                    onValueChange={(value) => 
                      setModuleAssignments(prev => ({ ...prev, [moduleType]: value }))
                    }
                    value={moduleAssignments[moduleType] || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select module for ${formatModuleSlotName(moduleType)}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleModules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {compatibleModules.length === 0 && (
                    <p className="text-sm text-orange-600">
                      No compatible modules found for {formatModuleSlotName(moduleType)}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Create Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleCreateExam}
              disabled={!canCreateExam() || isCreating}
              className="w-full"
              size="lg"
            >
              {isCreating ? 'Creating Exam...' : 'Create Exam'}
            </Button>
            {!areAllSlotsAssigned() && selectedTemplateId && (
              <p className="text-sm text-orange-600 mt-2">
                Please assign modules to all required slots before creating the exam.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}