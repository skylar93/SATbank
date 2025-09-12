'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnswerReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  examId: string
  examTitle: string
  onConfirm: (
    visibilityOption: 'hidden' | 'immediate' | 'scheduled' | 'per_question',
    releaseTimestamp?: Date
  ) => Promise<void>
}

export default function AnswerReleaseModal({
  isOpen,
  onClose,
  examId,
  examTitle,
  onConfirm,
}: AnswerReleaseModalProps) {
  const [visibilityOption, setVisibilityOption] = useState<
    'hidden' | 'immediate' | 'scheduled' | 'per_question'
  >('hidden')
  const [releaseDate, setReleaseDate] = useState<Date>()
  const [releaseTime, setReleaseTime] = useState('12:00')
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      let releaseTimestamp: Date | undefined

      if (visibilityOption === 'scheduled' && releaseDate) {
        const [hours, minutes] = releaseTime.split(':').map(Number)
        releaseTimestamp = new Date(releaseDate)
        releaseTimestamp.setHours(hours, minutes, 0, 0)
      }

      await onConfirm(visibilityOption, releaseTimestamp)
      onClose()

      // Reset form
      setVisibilityOption('hidden')
      setReleaseDate(undefined)
      setReleaseTime('12:00')
    } catch (error) {
      console.error('Error updating answer visibility:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    visibilityOption !== 'scheduled' || (releaseDate && releaseTime)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>Answer Release Settings</DialogTitle>
          <DialogDescription>
            Configure when students can see correct answers for{' '}
            <strong>{examTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <RadioGroup
            value={visibilityOption}
            onValueChange={(
              value: 'hidden' | 'immediate' | 'scheduled' | 'per_question'
            ) => setVisibilityOption(value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hidden" id="hidden" />
              <Label htmlFor="hidden" className="font-medium">
                Keep Answers Hidden
              </Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">
              Answers will remain hidden from all students who took this exam.
            </p>

            <div className="flex items-center space-x-2 mt-4">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="font-medium">
                Release Answers Immediately
              </Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">
              All students will be able to see correct answers right away.
            </p>

            <div className="flex items-center space-x-2 mt-4">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <Label htmlFor="scheduled" className="font-medium">
                Release Answers on Specific Date
              </Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">
              Choose a specific date and time when answers will become visible.
            </p>

            <div className="flex items-center space-x-2 mt-4">
              <RadioGroupItem value="per_question" id="per_question" />
              <Label htmlFor="per_question" className="font-medium">
                Show Answers After Each Question
              </Label>
            </div>
            <p className="text-sm text-gray-600 ml-6">
              Students can see the correct answer immediately after submitting
              each question.
            </p>
          </RadioGroup>

          {visibilityOption === 'scheduled' && (
            <div className="ml-6 space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="release-date" className="text-sm font-medium">
                  Release Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-1',
                        !releaseDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {releaseDate ? (
                        format(releaseDate, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={releaseDate}
                      onSelect={setReleaseDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="release-time" className="text-sm font-medium">
                  Release Time
                </Label>
                <input
                  type="time"
                  id="release-time"
                  value={releaseTime}
                  onChange={(e) => setReleaseTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isFormValid || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Updating...' : 'Confirm & Apply to All Attempts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
