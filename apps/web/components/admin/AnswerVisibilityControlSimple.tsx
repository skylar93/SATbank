'use client'

import { useState } from 'react'
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
  isUpdating?: boolean
  onVisibilityChange?: (examId: string, visibility: 'hidden' | 'immediate' | 'scheduled', releaseDate?: string | null) => void
}

export function AnswerVisibilityControl({
  examId,
  currentVisibility,
  isUpdating = false,
  onVisibilityChange
}: AnswerVisibilityControlProps) {
  console.log('🔍 AnswerVisibilityControl render:', { 
    examId, 
    currentVisibility: JSON.stringify(currentVisibility), 
    isUpdating,
    timestamp: new Date().getTime()
  })
  
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentVisibility.scheduled_date || new Date()
  )

  const handleVisibilityChange = (value: string) => {
    console.log('👁️ AnswerVisibilityControl handleVisibilityChange:', { examId, value })
    
    if (value === 'scheduled') {
      setShowCalendar(true)
      return
    }

    const visibility = value as 'hidden' | 'immediate'
    console.log('📞 Calling onVisibilityChange:', { examId, visibility })
    onVisibilityChange?.(examId, visibility)
  }

  const handleScheduledRelease = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setShowCalendar(false)
      onVisibilityChange?.(examId, 'scheduled', date.toISOString())
    }
  }

  const getDisplayContent = () => {
    switch (currentVisibility.type) {
      case 'immediate':
        return {
          icon: <Eye className="h-3 w-3" />,
          text: '',
          style:
            'px-2 py-1.5 text-xs font-medium text-green-700 rounded-full border border-gray-200 bg-gray-50',
        }
      case 'hidden':
        return {
          icon: <EyeOff className="h-3 w-3" />,
          text: '',
          style:
            'px-2 py-1.5 text-xs font-medium text-red-700 rounded-full border border-gray-200 bg-gray-50',
        }
      case 'scheduled':
        return {
          icon: <Clock className="h-3 w-3" />,
          text: '',
          style:
            'px-2 py-1.5 text-xs font-medium text-orange-700 rounded-full border border-gray-200 bg-gray-50',
        }
      default:
        return {
          icon: <EyeOff className="h-3 w-3" />,
          text: '',
          style:
            'px-2 py-1.5 text-xs font-medium text-gray-500 rounded-full border border-gray-200 bg-gray-50',
        }
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}

        <Select
          key={`${examId}-${currentVisibility.type}`}
          value={currentVisibility.type}
          onValueChange={handleVisibilityChange}
          disabled={isUpdating}
        >
          <SelectTrigger className={`w-auto h-auto ${getDisplayContent().style}`}>
            <div className="flex items-center">{getDisplayContent().icon}</div>
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

      {currentVisibility.type === 'scheduled' &&
        currentVisibility.scheduled_date && (
          <div className="text-xs text-gray-600">
            Release: {format(currentVisibility.scheduled_date, 'PPP p')}
          </div>
        )}
    </div>
  )
}
