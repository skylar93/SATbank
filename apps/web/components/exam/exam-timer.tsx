'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'

// Pure utility function moved outside component for better performance
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

interface ExamTimerProps {
  initialTimeSeconds: number // Total time for this module in seconds
  onTimeExpired: () => void // Called when timer reaches 0
  onTimeUpdate?: (remainingSeconds: number) => void // Optional callback for time updates
  isPaused?: boolean // Pause the timer
}

const ExamTimerComponent = function ExamTimer({
  initialTimeSeconds,
  onTimeExpired,
  onTimeUpdate,
  isPaused = false,
}: ExamTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimeSeconds)
  const [isRunning, setIsRunning] = useState(true)

  // Use refs to store callbacks to prevent infinite re-renders
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onTimeExpiredRef = useRef(onTimeExpired)
  
  // Track actual start time to handle tab switching
  const startTimeRef = useRef<number>(Date.now())

  // Update refs when callbacks change
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])

  useEffect(() => {
    onTimeExpiredRef.current = onTimeExpired
  }, [onTimeExpired])

  // Determine timer color based on remaining time
  const getTimerColor = useCallback(
    (seconds: number) => {
      const totalTime = initialTimeSeconds
      const percentRemaining = (seconds / totalTime) * 100

      if (percentRemaining <= 5) return 'text-red-600 bg-red-50' // Critical: < 5%
      if (percentRemaining <= 15) return 'text-orange-600 bg-orange-50' // Warning: < 15%
      if (percentRemaining <= 30) return 'text-yellow-600 bg-yellow-50' // Caution: < 30%
      return 'text-green-600 bg-green-50' // Normal: > 30%
    },
    [initialTimeSeconds]
  )

  // Handle visibility changes to immediately update timer when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isRunning && !isPaused) {
        // Tab became visible - immediately update timer with accurate time
        const now = Date.now()
        const totalElapsed = Math.floor((now - startTimeRef.current) / 1000)
        const newRemainingSeconds = Math.max(0, initialTimeSeconds - totalElapsed)
        setRemainingSeconds(newRemainingSeconds)
        
        console.log(`Tab became visible, updated timer to ${newRemainingSeconds} seconds remaining`)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRunning, isPaused, initialTimeSeconds])

  useEffect(() => {
    if (isPaused || !isRunning) return

    let animationFrameId: number
    
    const updateTimer = () => {
      const now = Date.now()
      const totalElapsed = Math.floor((now - startTimeRef.current) / 1000)
      const newRemainingSeconds = Math.max(0, initialTimeSeconds - totalElapsed)
      
      setRemainingSeconds(newRemainingSeconds)
      
      // Continue updating
      if (newRemainingSeconds > 0) {
        animationFrameId = requestAnimationFrame(() => {
          setTimeout(updateTimer, 1000)
        })
      }
    }

    // Start the timer
    updateTimer()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isPaused, isRunning, initialTimeSeconds])

  // Separate effect for callbacks to avoid setState during render
  useEffect(() => {
    if (onTimeUpdateRef.current) {
      onTimeUpdateRef.current(remainingSeconds)
    }

    if (remainingSeconds === 0 && isRunning) {
      console.log('Timer reached 0, calling onTimeExpired')
      setIsRunning(false)
      if (onTimeExpiredRef.current) {
        console.log('Calling onTimeExpired callback')
        onTimeExpiredRef.current()
      } else {
        console.error('onTimeExpired callback not found!')
      }
    }
  }, [remainingSeconds, isRunning])

  // Reset timer when initialTimeSeconds changes (new module)
  useEffect(() => {
    setRemainingSeconds(initialTimeSeconds)
    setIsRunning(true)
    // Reset start time for new module
    startTimeRef.current = Date.now()
  }, [initialTimeSeconds])

  const timerColor = getTimerColor(remainingSeconds)
  const isLowTime = remainingSeconds <= initialTimeSeconds * 0.15 // Warning when < 15% time left

  return (
    <div className="flex items-center space-x-3">
      <div
        className={`
        px-4 py-2 rounded-lg border-2 transition-all duration-300
        ${timerColor}
        ${isLowTime ? 'animate-pulse border-current' : 'border-gray-200'}
      `}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-current"></div>
          <span className="font-mono text-lg font-bold">
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>

      {isLowTime && (
        <div className="text-sm text-red-600 font-medium animate-pulse">
          Time Running Low!
        </div>
      )}

      {remainingSeconds === 0 && (
        <div className="text-sm text-red-700 font-bold">TIME'S UP</div>
      )}
    </div>
  )
}

// Memoized component - prevents unnecessary re-renders when props haven't changed
export const ExamTimer = memo(ExamTimerComponent)
