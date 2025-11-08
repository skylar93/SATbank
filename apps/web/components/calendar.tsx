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
  getDate,
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
    return events.find((event) => isSameDay(event.date, date))
  }

  const isSelected = (date: Date) => {
    return selectedDate && isSameDay(date, selectedDate)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-7 gap-1 mb-3 min-w-[360px]"
          style={{ gridTemplateColumns: 'repeat(7, minmax(2.5rem, 1fr))' }}
        >
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto mb-6">
        <div
          className="grid grid-cols-7 gap-1 min-w-[360px]"
          style={{ gridTemplateColumns: 'repeat(7, minmax(2.5rem, 1fr))' }}
        >
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
                relative w-full aspect-square min-w-[2.5rem] text-[0.7rem] sm:text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center
                ${
                  !isCurrentMonth
                    ? 'text-gray-300 hover:text-gray-400'
                    : 'text-gray-700 hover:bg-gray-100'
                }
                ${isTodayDate && isCurrentMonth ? 'bg-violet-600 text-white font-bold' : ''}
                ${isSelectedDate && !isTodayDate ? 'bg-violet-100 text-violet-700' : ''}
                ${event ? 'ring-2 ring-violet-200' : ''}
              `}
            >
              {getDate(day)}
              {event && (
                <div
                  className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                    event.type === 'visit'
                      ? 'bg-green-500'
                      : event.type === 'strike'
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                  }`}
                />
              )}
            </button>
          )
          })}
        </div>
      </div>

      {/* Your Tasks Section */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Your tasks</h4>
          <button className="text-xs text-gray-500 hover:text-gray-700">
            Set hours & timeframes
          </button>
        </div>

        <div className="space-y-3">
          {/* Task 1 */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Practice
                </span>
                <span className="text-xs text-gray-500">20</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Math Practice</p>
            </div>
          </div>

          {/* Task 2 */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Reading
                </span>
                <span className="text-xs text-gray-500">20</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Reading Practice</p>
            </div>
          </div>

          {/* Task 3 */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Writing
                </span>
                <span className="text-xs text-gray-500">20</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Writing Practice</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
