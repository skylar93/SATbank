'use client'

import { useState, useEffect, useRef } from 'react'
import { ModuleType } from '../../lib/exam-service'

interface QuestionTimerProps {
  /** Current module type - timer only shows for English modules */
  module: ModuleType
  /** Question ID to reset timer when question changes */
  questionId: string
  /** Whether the exam is paused or completed */
  isPaused: boolean
}

export function QuestionTimer({ module, questionId, isPaused }: QuestionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [isExpired, setIsExpired] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const pausedAtRef = useRef<number | null>(null)
  
  // Only show timer for English modules
  const shouldShowTimer = module === 'english1' || module === 'english2'
  
  // Reset timer when question changes
  useEffect(() => {
    if (!shouldShowTimer) return
    
    setTimeRemaining(60)
    setIsExpired(false)
    startTimeRef.current = Date.now()
    pausedAtRef.current = null
  }, [questionId, shouldShowTimer])
  
  // Handle timer logic
  useEffect(() => {
    if (!shouldShowTimer || isPaused || isExpired) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      if (isPaused && !pausedAtRef.current) {
        pausedAtRef.current = Date.now()
      }
      
      return
    }
    
    // Resume from pause
    if (pausedAtRef.current && startTimeRef.current) {
      const pausedDuration = Date.now() - pausedAtRef.current
      startTimeRef.current += pausedDuration
      pausedAtRef.current = null
    }
    
    // Set start time if not set
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }
    
    intervalRef.current = setInterval(() => {
      if (!startTimeRef.current) return
      
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const remaining = Math.max(0, 60 - elapsed)
      
      setTimeRemaining(remaining)
      
      if (remaining === 0) {
        setIsExpired(true)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }, 1000)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [shouldShowTimer, isPaused, isExpired, questionId])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
  
  if (!shouldShowTimer) {
    return null
  }
  
  return (
    <div className={`
      inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors
      ${isExpired 
        ? 'bg-red-100 text-red-700 border border-red-200' 
        : timeRemaining <= 10 
          ? 'bg-amber-100 text-amber-700 border border-amber-200'
          : 'bg-blue-100 text-blue-700 border border-blue-200'
      }
    `}>
      <svg 
        className="w-3 h-3 mr-1" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
      <span>
        {isExpired ? 'Time Up' : `${timeRemaining}s`}
      </span>
    </div>
  )
}