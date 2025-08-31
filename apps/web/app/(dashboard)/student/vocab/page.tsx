'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { Plus, BookOpen, Calendar } from 'lucide-react'
import Link from 'next/link'

interface VocabSet {
  id: number
  title: string
  description: string | null
  created_at: string
  entry_count?: number
}

export default function VocabSetsPage() {
  const [vocabSets, setVocabSets] = useState<VocabSet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newSetTitle, setNewSetTitle] = useState('')
  const [newSetDescription, setNewSetDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // Use the centralized Supabase client

  useEffect(() => {
    fetchVocabSets()
  }, [])

  const fetchVocabSets = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setToast({
          message: 'Please log in to view your vocabulary sets',
          type: 'error',
        })
        return
      }

      // Fetch vocab sets with entry count
      const { data: sets, error } = await supabase
        .from('vocab_sets')
        .select(
          `
          id,
          title,
          description,
          created_at,
          vocab_entries(count)
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data to include entry count
      const setsWithCount =
        sets?.map((set) => ({
          ...set,
          entry_count: set.vocab_entries?.[0]?.count || 0,
        })) || []

      setVocabSets(setsWithCount)
    } catch (error) {
      console.error('Error fetching vocab sets:', error)
      setToast({ message: 'Failed to load vocabulary sets', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSet = async () => {
    if (!newSetTitle.trim()) {
      setToast({
        message: 'Please enter a title for your vocabulary set',
        type: 'error',
      })
      return
    }

    setIsCreating(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('vocab_sets').insert({
        user_id: user.id,
        title: newSetTitle.trim(),
        description: newSetDescription.trim() || null,
      })

      if (error) throw error

      setToast({
        message: 'Vocabulary set created successfully!',
        type: 'success',
      })
      setNewSetTitle('')
      setNewSetDescription('')
      setIsCreateDialogOpen(false)
      fetchVocabSets()
    } catch (error) {
      console.error('Error creating vocab set:', error)
      setToast({ message: 'Failed to create vocabulary set', type: 'error' })
    } finally {
      setIsCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              My Vocabulary Sets
            </h1>
            <p className="text-gray-600">
              Create and manage your personal vocabulary collections
            </p>
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Set
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Vocabulary Set</DialogTitle>
                <DialogDescription>
                  Create a new collection of vocabulary words to study and quiz
                  yourself on.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title *</Label>
                  <input
                    id="title"
                    placeholder="e.g., SAT Essential Words, Biology Terms"
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <textarea
                    id="description"
                    placeholder="Brief description of this vocabulary set..."
                    value={newSetDescription}
                    onChange={(e) => setNewSetDescription(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSet}
                  disabled={isCreating || !newSetTitle.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Set'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {vocabSets.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No vocabulary sets yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first vocabulary set to start building your personal
              word collection.
            </p>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Set
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Vocabulary Set</DialogTitle>
                  <DialogDescription>
                    Create a new collection of vocabulary words to study and
                    quiz yourself on.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <input
                      id="title"
                      placeholder="e.g., SAT Essential Words, Biology Terms"
                      value={newSetTitle}
                      onChange={(e) => setNewSetTitle(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <textarea
                      id="description"
                      placeholder="Brief description of this vocabulary set..."
                      value={newSetDescription}
                      onChange={(e) => setNewSetDescription(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSet}
                    disabled={isCreating || !newSetTitle.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Create Set'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vocabSets.map((set) => (
              <Card key={set.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{set.title}</CardTitle>
                  {set.description && (
                    <CardDescription>{set.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {set.entry_count} words
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(set.created_at)}
                    </span>
                  </div>
                  <Link href={`/student/vocab/${set.id}`}>
                    <Button className="w-full">Manage Words</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
