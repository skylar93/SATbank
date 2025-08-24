'use client'

import { useState, useTransition } from 'react'
import { updateAnswerVisibilityForAttempt } from '@/lib/exam-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Clock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface AnswerVisibilityControlProps {
  examId: string
  currentVisibility: {
    type: 'hidden' | 'immediate' | 'scheduled'
    scheduled_date?: Date
  }
}

export function AnswerVisibilityControl({
  examId,
  currentVisibility
}: AnswerVisibilityControlProps) {
  const [isPending, startTransition] = useTransition()
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentVisibility.scheduled_date || new Date()
  )

  const handleVisibilityChange = (value: string) => {
    if (value === 'scheduled') {
      setShowCalendar(true)
      return
    }

    const visibility = value as 'hidden' | 'immediate'
    startTransition(async () => {
      try {
        const result = await updateAnswerVisibilityForAttempt(examId, visibility)
        if (!result.success) {
          alert(`Failed to update answer visibility: ${result.message}`)
        }
      } catch (error) {
        console.error('Error updating answer visibility:', error)
        alert('Failed to update answer visibility. Please try again.')
      }
    })
  }

  const handleScheduledRelease = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      startTransition(async () => {
        try {
          const result = await updateAnswerVisibilityForAttempt(examId, 'scheduled', date.toISOString())
          if (!result.success) {
            alert(`Failed to update answer visibility: ${result.message}`)
          }
          setShowCalendar(false)
        } catch (error) {
          console.error('Error updating answer visibility:', error)
          alert('Failed to update answer visibility. Please try again.')
        }
      })
    }
  }

  const getDisplayContent = () => {
    switch (currentVisibility.type) {
      case 'immediate':
        return {
          icon: <Eye className="h-3 w-3 mr-1" />,
          text: 'Answers Visible',
          style: 'px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full border border-green-200 shadow-sm'
        }
      case 'hidden':
        return {
          icon: <EyeOff className="h-3 w-3 mr-1" />,
          text: 'Answers Hidden',
          style: 'px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-red-100 to-pink-100 text-red-700 rounded-full border border-red-200 shadow-sm'
        }
      case 'scheduled':
        return {
          icon: <Clock className="h-3 w-3 mr-1" />,
          text: 'Scheduled Release',
          style: 'px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 rounded-full border border-orange-200 shadow-sm'
        }
      default:
        return {
          icon: <EyeOff className="h-3 w-3 mr-1" />,
          text: 'No Setting',
          style: 'px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full border border-gray-200'
        }
    }
  }

  const display = getDisplayContent()

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        
        <Select 
          value={currentVisibility.type} 
          onValueChange={handleVisibilityChange}
          disabled={isPending}
        >
          <SelectTrigger className={`w-auto h-auto ${display.style}`}>
            <div className="flex items-center">
              {display.icon}
              <SelectValue>{display.text}</SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-2" />
                <span>Release Immediately</span>
              </div>
            </SelectItem>
            <SelectItem value="hidden">
              <div className="flex items-center">
                <EyeOff className="h-4 w-4 mr-2" />
                <span>Keep Hidden</span>
              </div>
            </SelectItem>
            <SelectItem value="scheduled">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <span>Schedule Release...</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showCalendar && (
        <Popover open={showCalendar} onOpenChange={setShowCalendar}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full mt-2">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Select Date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleScheduledRelease}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}

      {currentVisibility.type === 'scheduled' && currentVisibility.scheduled_date && (
        <div className="text-xs text-gray-600">
          Release: {format(currentVisibility.scheduled_date, 'PPP p')}
        </div>
      )}
    </div>
  )
}