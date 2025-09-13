'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { addWordsInBulk } from '@/lib/vocab-actions'
import { toast } from 'sonner'

interface BulkAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAddWords: (words: { term: string; definition: string }[]) => Promise<void>
  setId: number
}

export function BulkAddModal({
  isOpen,
  onClose,
  onAddWords,
  setId,
}: BulkAddModalProps) {
  const [pastedText, setPastedText] = useState('')
  const [parsedWords, setParsedWords] = useState<
    { term: string; definition: string }[]
  >([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [step, setStep] = useState<'paste' | 'preview'>('paste')
  const [isPending, startTransition] = useTransition()

  const handlePreview = () => {
    setParsedWords([])
    setParseError(null)

    if (!pastedText.trim()) {
      setParseError('Please paste some text to process.')
      return
    }

    const lines = pastedText.split('\n')
    const tempWords: { term: string; definition: string }[] = []
    let hasErrors = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines
      if (!line) continue

      const parts = line.split('\t')

      // Validation
      if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        setParseError(
          `Error on line ${i + 1}: Please ensure the word and definition are separated by a Tab character. Make sure both term and definition are not empty.`
        )
        hasErrors = true
        break
      }

      tempWords.push({
        term: parts[0].trim(),
        definition: parts[1].trim(),
      })
    }

    if (!hasErrors) {
      if (tempWords.length === 0) {
        setParseError(
          'No valid word entries found. Make sure each line contains a term and definition separated by a Tab character.'
        )
        return
      }

      setParsedWords(tempWords)
      setStep('preview')
    }
  }

  const handleAddWords = () => {
    startTransition(async () => {
      try {
        const result = await addWordsInBulk(setId, parsedWords)

        if (result.success) {
          toast.success(`Successfully added ${parsedWords.length} words to your vocabulary set!`)
          await onAddWords(parsedWords)
          handleClose()
        } else {
          toast.error(result.message || 'Failed to add words')
          setParseError(result.message || 'Failed to add words')
        }
      } catch (error) {
        console.error('Error adding words:', error)
        toast.error('Failed to add words. Please try again.')
        setParseError('Failed to add words. Please try again.')
      }
    })
  }

  const handleClose = () => {
    setPastedText('')
    setParsedWords([])
    setParseError(null)
    setStep('paste')
    onClose()
  }

  const goBackToEdit = () => {
    setStep('paste')
    setParseError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Words</DialogTitle>
          <DialogDescription>
            Paste your words below. Each line should contain one word and its
            definition, separated by a Tab. (Copying directly from Excel or
            Google Sheets works best)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'paste' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="bulk-text">Paste Your Words Here</Label>
                <textarea
                  id="bulk-text"
                  placeholder="ephemeral	lasting for a very short time&#10;ubiquitous	present, appearing, or found everywhere&#10;serendipity	the occurrence of events in a happy or beneficial way"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Example format: Each line should have "word[TAB]definition"
                </p>
              </div>

              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700 font-medium">
                  Found {parsedWords.length} words to add
                </p>
              </div>

              <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Term
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Definition
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedWords.map((word, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-3 py-2 font-medium border-b">
                          {word.term}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {word.definition}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{parseError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'paste' && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={isPending || !pastedText.trim()}
              >
                Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={goBackToEdit}
                disabled={isPending}
              >
                Back to Edit
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddWords}
                disabled={isPending || parsedWords.length === 0}
              >
                {isPending
                  ? 'Adding Words...'
                  : `Add ${parsedWords.length} Words to Set`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
