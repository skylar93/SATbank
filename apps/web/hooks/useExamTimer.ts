import { useCallback, useRef } from 'react'

interface UseExamTimerProps {
  status: string
  currentModuleIndex: number
  modules: any[]
  timeExpired: () => void
  handleTimeExpiredFromHook: () => Promise<void>
  updateTimer: (timeRemaining: number) => void
}

export const useExamTimer = ({
  status,
  currentModuleIndex,
  modules,
  timeExpired,
  handleTimeExpiredFromHook,
  updateTimer,
}: UseExamTimerProps) => {
  const timeExpiredRef = useRef(false)
  const isAdvancingModuleRef = useRef(false)

  // Handle timer expiration with immediate state change
  const handleTimeExpired = useCallback(() => {
    console.log(
      'Timer expired! Current module:',
      currentModuleIndex,
      'Total modules:',
      modules.length
    )

    // Set flag to prevent further input
    timeExpiredRef.current = true

    // Immediately set time_expired status - no delay
    timeExpired()
  }, [timeExpired, currentModuleIndex, modules.length])

  // Handle the actual module advancement when status changes to time_expired
  const handleModuleAdvancement = useCallback(
    async (router: any) => {
      if (status === 'time_expired' && !isAdvancingModuleRef.current) {
        isAdvancingModuleRef.current = true
        console.log('Status changed to time_expired, advancing module...')

        try {
          console.log('Calling handleTimeExpiredFromHook...')
          await handleTimeExpiredFromHook()
          console.log('Successfully advanced module')

          // Navigate to results if exam is complete
          if (currentModuleIndex >= modules.length - 1) {
            console.log('Exam complete, navigating to results')
            router.push('/student/results')
          }
        } catch (error) {
          console.error('Error advancing module:', error)
        } finally {
          // Reset flags for next module
          timeExpiredRef.current = false
          isAdvancingModuleRef.current = false
        }
      }
    },
    [status, handleTimeExpiredFromHook, currentModuleIndex, modules.length]
  )

  const resetTimerFlags = useCallback(() => {
    timeExpiredRef.current = false
    isAdvancingModuleRef.current = false
  }, [])

  return {
    handleTimeExpired,
    handleModuleAdvancement,
    resetTimerFlags,
    timeExpiredRef,
    updateTimer,
  }
}
