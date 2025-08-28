'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Toast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase'
import { Plus, BookOpen, Calendar, Edit, Trash2, Play, ArrowLeft, FileUp } from 'lucide-react'
import Link from 'next/link'
import { BulkAddModal } from '@/components/vocab/BulkAddModal'

interface VocabSet {
  id: number
  title: string
  description: string | null
  created_at: string
}

interface VocabEntry {
  id: number
  term: string
  definition: string
  example_sentence: string | null
  mastery_level: number
  last_reviewed_at: string | null
  created_at: string
}

export default function VocabSetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const setId = params.setId as string

  const [vocabSet, setVocabSet] = useState<VocabSet | null>(null)
  const [entries, setEntries] = useState<VocabEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // New word form state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newTerm, setNewTerm] = useState('')
  const [newDefinition, setNewDefinition] = useState('')
  const [newExample, setNewExample] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Edit word form state
  const [editingEntry, setEditingEntry] = useState<VocabEntry | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editDefinition, setEditDefinition] = useState('')
  const [editExample, setEditExample] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Quiz configuration state
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false)
  const [quizType, setQuizType] = useState<'term_to_def' | 'def_to_term'>('term_to_def')
  const [quizFormat, setQuizFormat] = useState<'multiple_choice' | 'written_answer'>('multiple_choice')
  const [questionPool, setQuestionPool] = useState<'all' | 'unmastered' | 'not_recent' | 'smart_review'>('all')

  // Bulk add state
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false)

  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchVocabSetAndEntries()
  }, [setId])

  const fetchVocabSetAndEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setToast({ message: 'Please log in to access your vocabulary sets', type: 'error' })
        router.push('/login')
        return
      }

      // Fetch vocab set details
      const { data: set, error: setError } = await supabase
        .from('vocab_sets')
        .select('*')
        .eq('id', setId)
        .eq('user_id', user.id)
        .single()

      if (setError) {
        if (setError.code === 'PGRST116') {
          setToast({ message: 'Vocabulary set not found', type: 'error' })
          router.push('/student/vocab')
          return
        }
        throw setError
      }

      setVocabSet(set)

      // Fetch vocab entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('vocab_entries')
        .select('*')
        .eq('set_id', setId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (entriesError) throw entriesError

      setEntries(entriesData || [])
    } catch (error) {
      console.error('Error fetching vocab set:', error)
      setToast({ message: 'Failed to load vocabulary set', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddEntry = async () => {
    if (!newTerm.trim() || !newDefinition.trim()) {
      setToast({ message: 'Please fill in both term and definition', type: 'error' })
      return
    }

    setIsCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('vocab_entries')
        .insert({
          set_id: parseInt(setId),
          user_id: user.id,
          term: newTerm.trim(),
          definition: newDefinition.trim(),
          example_sentence: newExample.trim() || null
        })

      if (error) throw error

      setToast({ message: 'Word added successfully!', type: 'success' })
      setNewTerm('')
      setNewDefinition('')
      setNewExample('')
      setIsAddDialogOpen(false)
      fetchVocabSetAndEntries()
    } catch (error) {
      console.error('Error adding entry:', error)
      setToast({ message: 'Failed to add word', type: 'error' })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditEntry = (entry: VocabEntry) => {
    setEditingEntry(entry)
    setEditTerm(entry.term)
    setEditDefinition(entry.definition)
    setEditExample(entry.example_sentence || '')
  }

  const handleUpdateEntry = async () => {
    if (!editTerm.trim() || !editDefinition.trim()) {
      setToast({ message: 'Please fill in both term and definition', type: 'error' })
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('vocab_entries')
        .update({
          term: editTerm.trim(),
          definition: editDefinition.trim(),
          example_sentence: editExample.trim() || null
        })
        .eq('id', editingEntry!.id)

      if (error) throw error

      setToast({ message: 'Word updated successfully!', type: 'success' })
      setEditingEntry(null)
      fetchVocabSetAndEntries()
    } catch (error) {
      console.error('Error updating entry:', error)
      setToast({ message: 'Failed to update word', type: 'error' })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this word?')) return

    try {
      const { error } = await supabase
        .from('vocab_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      setToast({ message: 'Word deleted successfully!', type: 'success' })
      fetchVocabSetAndEntries()
    } catch (error) {
      console.error('Error deleting entry:', error)
      setToast({ message: 'Failed to delete word', type: 'error' })
    }
  }

  const handleStartQuiz = () => {
    if (entries.length === 0) {
      setToast({ message: 'Add some words before starting a quiz', type: 'error' })
      return
    }

    const filteredEntries = questionPool === 'unmastered' 
      ? entries.filter(e => e.mastery_level < 3)
      : questionPool === 'not_recent'
      ? entries.filter(e => !e.last_reviewed_at || new Date(e.last_reviewed_at) < new Date(Date.now() - 24 * 60 * 60 * 1000))
      : questionPool === 'smart_review'
      ? entries.filter(e => {
          // For smart review, we'll let the quiz page handle the filtering
          // since it needs to check next_review_date which isn't loaded here
          return true;
        })
      : entries

    if (filteredEntries.length === 0) {
      setToast({ message: 'No words match the selected criteria', type: 'error' })
      return
    }

    const queryParams = new URLSearchParams({
      setId: setId,
      type: quizType,
      format: quizFormat,
      pool: questionPool
    })

    router.push(`/student/vocab/quiz?${queryParams.toString()}`)
  }

  const handleBulkAddWords = async (words: { term: string; definition: string }[]) => {
    try {
      setToast({ message: `Successfully added ${words.length} words!`, type: 'success' })
      setIsBulkAddModalOpen(false)
      await fetchVocabSetAndEntries()
    } catch (error) {
      console.error('Error in bulk add handler:', error)
      setToast({ message: 'Failed to add words', type: 'error' })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getMasteryLabel = (level: number) => {
    const labels = ['New', 'Learning', 'Familiar', 'Known', 'Mastered', 'Expert']
    return labels[Math.min(level, 5)]
  }

  const getMasteryColor = (level: number) => {
    const colors = [
      'bg-gray-200', 'bg-red-200', 'bg-orange-200', 
      'bg-yellow-200', 'bg-green-200', 'bg-blue-200'
    ]
    return colors[Math.min(level, 5)]
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-40 bg-gray-200 rounded mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!vocabSet) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900">Vocabulary set not found</h1>
          <Link href="/student/vocab">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Sets
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/student/vocab">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{vocabSet.title}</h1>
            {vocabSet.description && (
              <p className="text-gray-600">{vocabSet.description}</p>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {entries.length} words • Created {formatDate(vocabSet.created_at)}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex gap-4 mb-6">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Word
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Word</DialogTitle>
                <DialogDescription>
                  Add a new vocabulary word to this set.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="term">Term *</Label>
                  <input
                    id="term"
                    placeholder="e.g., ephemeral"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="definition">Definition *</Label>
                  <textarea
                    id="definition"
                    placeholder="e.g., lasting for a very short time"
                    value={newDefinition}
                    onChange={(e) => setNewDefinition(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="example">Example Sentence (Optional)</Label>
                  <textarea
                    id="example"
                    placeholder="e.g., Beauty is ephemeral, but memories last forever."
                    value={newExample}
                    onChange={(e) => setNewExample(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEntry}
                  disabled={isCreating || !newTerm.trim() || !newDefinition.trim()}
                >
                  {isCreating ? 'Adding...' : 'Add Word'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline"
            onClick={() => setIsBulkAddModalOpen(true)}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Bulk Add Words
          </Button>

          {entries.length > 0 && (
            <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />
                  Start Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Configure Quiz</DialogTitle>
                  <DialogDescription>
                    Customize your vocabulary quiz settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="grid gap-3">
                    <Label>Quiz Direction *</Label>
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="term_to_def"
                          checked={quizType === 'term_to_def'}
                          onChange={(e) => setQuizType(e.target.value as 'term_to_def')}
                        />
                        Show term, guess definition
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="def_to_term"
                          checked={quizType === 'def_to_term'}
                          onChange={(e) => setQuizType(e.target.value as 'def_to_term')}
                        />
                        Show definition, guess term
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Label>Question Format *</Label>
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="multiple_choice"
                          checked={quizFormat === 'multiple_choice'}
                          onChange={(e) => setQuizFormat(e.target.value as 'multiple_choice')}
                        />
                        Multiple choice
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="written_answer"
                          checked={quizFormat === 'written_answer'}
                          onChange={(e) => setQuizFormat(e.target.value as 'written_answer')}
                        />
                        Written answer
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Label>Question Pool</Label>
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="all"
                          checked={questionPool === 'all'}
                          onChange={(e) => setQuestionPool(e.target.value as 'all')}
                        />
                        All words ({entries.length})
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="unmastered"
                          checked={questionPool === 'unmastered'}
                          onChange={(e) => setQuestionPool(e.target.value as 'unmastered')}
                        />
                        Unmastered words ({entries.filter(e => e.mastery_level < 3).length})
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="not_recent"
                          checked={questionPool === 'not_recent'}
                          onChange={(e) => setQuestionPool(e.target.value as 'not_recent')}
                        />
                        Not recently reviewed
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="smart_review"
                          checked={questionPool === 'smart_review'}
                          onChange={(e) => setQuestionPool(e.target.value as 'smart_review')}
                        />
                        <span className="flex items-center gap-1">
                          🧠 <strong>Smart Review</strong> (SRS Algorithm)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsQuizDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleStartQuiz}>
                    Start Quiz Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Words List */}
        {entries.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No words yet</h3>
              <p className="text-gray-600 mb-6">Start building your vocabulary by adding your first word.</p>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Word
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add New Word</DialogTitle>
                    <DialogDescription>
                      Add a new vocabulary word to this set.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="term">Term *</Label>
                      <input
                        id="term"
                        placeholder="e.g., ephemeral"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="definition">Definition *</Label>
                      <textarea
                        id="definition"
                        placeholder="e.g., lasting for a very short time"
                        value={newDefinition}
                        onChange={(e) => setNewDefinition(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="example">Example Sentence (Optional)</Label>
                      <textarea
                        id="example"
                        placeholder="e.g., Beauty is ephemeral, but memories last forever."
                        value={newExample}
                        onChange={(e) => setNewExample(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddEntry}
                      disabled={isCreating || !newTerm.trim() || !newDefinition.trim()}
                    >
                      {isCreating ? 'Adding...' : 'Add Word'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{entry.term}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getMasteryColor(entry.mastery_level)}`}>
                          {getMasteryLabel(entry.mastery_level)}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{entry.definition}</p>
                      {entry.example_sentence && (
                        <p className="text-sm text-gray-600 italic">
                          "{entry.example_sentence}"
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-3">
                        Added {formatDate(entry.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEntry(entry)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        {editingEntry && (
          <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Word</DialogTitle>
                <DialogDescription>
                  Update the vocabulary word details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-term">Term *</Label>
                  <input
                    id="edit-term"
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-definition">Definition *</Label>
                  <textarea
                    id="edit-definition"
                    value={editDefinition}
                    onChange={(e) => setEditDefinition(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-example">Example Sentence (Optional)</Label>
                  <textarea
                    id="edit-example"
                    value={editExample}
                    onChange={(e) => setEditExample(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingEntry(null)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateEntry}
                  disabled={isUpdating || !editTerm.trim() || !editDefinition.trim()}
                >
                  {isUpdating ? 'Updating...' : 'Update Word'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Bulk Add Modal */}
        <BulkAddModal
          isOpen={isBulkAddModalOpen}
          onClose={() => setIsBulkAddModalOpen(false)}
          onAddWords={handleBulkAddWords}
          setId={parseInt(setId)}
        />

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  )
}