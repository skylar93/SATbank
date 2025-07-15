'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  getDate
} from 'date-fns'

interface CalendarEvent {
  date: Date
  type: 'visit' | 'strike' | 'exam'
  title?: string
}

interface CalendarProps {
  events?: CalendarEvent[]
  onDateClick?: (date: Date) => void
}

export function Calendar({ events = [], onDateClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = []
  let day = startDate

  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    onDateClick?.(date)
  }

  const getEventForDate = (date: Date) => {
    return events.find(event => isSameDay(event.date, date))
  }

  const isSelected = (date: Date) => {
    return selectedDate && isSameDay(date, selectedDate)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-violet-50 rounded-lg transition-colors group"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-600 group-hover:text-violet-600" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-violet-50 rounded-lg transition-colors group"
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-600 group-hover:text-violet-600" />
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-3">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, dayIdx) => {
          const event = getEventForDate(day)
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isTodayDate = isToday(day)
          const isSelectedDate = isSelected(day)
          
          return (
            <button
              key={dayIdx}
              onClick={() => handleDateClick(day)}
              className={`
                relative p-3 text-sm font-medium rounded-xl transition-all duration-200 min-h-[48px] flex items-center justify-center
                ${!isCurrentMonth 
                  ? 'text-gray-300 hover:text-gray-400' 
                  : 'text-gray-700 hover:bg-violet-50'
                }
                ${isTodayDate && !isSelectedDate ? 'bg-violet-100 text-violet-700 font-bold' : ''}
                ${isSelectedDate ? 'bg-violet-600 text-white shadow-lg scale-105' : ''}
                ${event ? 'ring-2 ring-offset-1 ' + (
                  event.type === 'visit' ? 'ring-green-200' :
                  event.type === 'strike' ? 'ring-red-200' :
                  'ring-blue-200'
                ) : ''}
              `}
            >
              <span className="relative z-10">{getDate(day)}</span>
              {event && (
                <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
                  event.type === 'visit' ? 'bg-green-500' :
                  event.type === 'strike' ? 'bg-red-500' :
                  'bg-blue-500'
                }`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend and Stats */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">This Month</p>
          <p className="text-xs text-gray-500">Track your progress</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <p className="text-xs font-medium text-gray-900">12</p>
            <p className="text-xs text-gray-500">Study Days</p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <p className="text-xs font-medium text-gray-900">1</p>
            <p className="text-xs text-gray-500">Strikes</p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
            <p className="text-xs font-medium text-gray-900">3</p>
            <p className="text-xs text-gray-500">Exams</p>
          </div>
        </div>

        {selectedDate && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900 mb-1">
              {format(selectedDate, 'EEEE, MMMM d')}
            </p>
            <p className="text-xs text-gray-600">
              {getEventForDate(selectedDate)?.title || 'No activities planned'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}