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
  const [isRunning, setIsRunning] = useState(initialTimeSeconds > 0) // Don't start timer if no time limit

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
        const newRemainingSeconds = Math.max(
          0,
          initialTimeSeconds - totalElapsed
        )
        setRemainingSeconds(newRemainingSeconds)

        console.log(
          `Tab became visible, updated timer to ${newRemainingSeconds} seconds remaining`
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRunning, isPaused, initialTimeSeconds])

  useEffect(() => {
    if (isPaused || !isRunning || initialTimeSeconds <= 0) return // Don't run timer if no time limit

    let timeoutId: NodeJS.Timeout

    const updateTimer = () => {
      const now = Date.now()
      const totalElapsed = Math.floor((now - startTimeRef.current) / 1000)
      const newRemainingSeconds = Math.max(0, initialTimeSeconds - totalElapsed)

      setRemainingSeconds(newRemainingSeconds)

      // Continue updating
      if (newRemainingSeconds > 0) {
        timeoutId = setTimeout(updateTimer, 1000)
      }
    }

    // Start the timer
    timeoutId = setTimeout(updateTimer, 1000)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isPaused, isRunning, initialTimeSeconds])

  // Track previous remaining seconds to prevent unnecessary updates
  const prevRemainingSecondsRef = useRef<number>(remainingSeconds)

  // Separate effect for callbacks to avoid setState during render
  useEffect(() => {
    // Only call onTimeUpdate if the time has actually changed
    if (
      onTimeUpdateRef.current &&
      prevRemainingSecondsRef.current !== remainingSeconds
    ) {
      onTimeUpdateRef.current(remainingSeconds)
      prevRemainingSecondsRef.current = remainingSeconds
    }

    if (remainingSeconds === 0 && isRunning && initialTimeSeconds > 0) {
      // Only expire if there was a time limit
      console.log('Timer reached 0, calling onTimeExpired')
      setIsRunning(false)
      if (onTimeExpiredRef.current) {
        console.log('Calling onTimeExpired callback')
        onTimeExpiredRef.current()
      } else {
        console.error('onTimeExpired callback not found!')
      }
    }
  }, [remainingSeconds, isRunning, initialTimeSeconds])

  // Reset timer when initialTimeSeconds changes (new module)
  useEffect(() => {
    setRemainingSeconds(initialTimeSeconds)
    setIsRunning(initialTimeSeconds > 0) // Only start timer if there's a time limit
    // Reset start time for new module
    startTimeRef.current = Date.now()
    // Reset previous time reference
    prevRemainingSecondsRef.current = initialTimeSeconds
  }, [initialTimeSeconds])

  // Don't render timer if no time limit
  if (initialTimeSeconds <= 0) {
    return (
      <div className="flex items-center">
        <div className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span className="font-mono text-sm font-semibold">∞</span>
          </div>
        </div>
      </div>
    )
  }

  const timerColor = getTimerColor(remainingSeconds)
  const isLowTime = remainingSeconds <= initialTimeSeconds * 0.15 // Warning when < 15% time left

  // Extract just the text color class from timerColor (e.g. "text-green-600 bg-green-50" → "text-green-600")
  const textColorClass = timerColor.split(' ').find(c => c.startsWith('text-')) || 'text-gray-700'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border bg-white/80 backdrop-blur-sm
          transition-all duration-300
          ${textColorClass}
          ${isLowTime ? 'animate-pulse border-current' : 'border-gray-200'}
        `}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-current"></div>
          <span className="font-mono text-sm font-semibold">
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>

      {isLowTime && (
        <div className="hidden sm:block text-xs text-red-500 font-medium animate-pulse">
          Low time
        </div>
      )}

      {remainingSeconds === 0 && initialTimeSeconds > 0 && (
        <div className="text-xs text-red-700 font-bold">TIME'S UP</div>
      )}
    </div>
  )
}

// Memoized component - prevents unnecessary re-renders when props haven't changed
export const ExamTimer = memo(ExamTimerComponent)
