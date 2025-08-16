'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ExamTimerProps {
  initialTimeSeconds: number // Total time for this module in seconds
  onTimeExpired: () => void // Called when timer reaches 0
  onTimeUpdate?: (remainingSeconds: number) => void // Optional callback for time updates
  isPaused?: boolean // Pause the timer
}

export function ExamTimer({
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

  // Update refs when callbacks change
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])

  useEffect(() => {
    onTimeExpiredRef.current = onTimeExpired
  }, [onTimeExpired])

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

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

  useEffect(() => {
    if (isPaused || !isRunning) return

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        const newTime = Math.max(0, prev - 1)
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isPaused, isRunning])

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
