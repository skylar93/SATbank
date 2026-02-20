'use client'
import { useAuth } from '@/contexts/auth-context'
import {
  useImpersonation,
  IMPERSONATION_EVENT,
  IMPERSONATION_DATA_KEY,
} from '@/hooks/use-impersonation'
import { useState, useEffect, useRef } from 'react'

export function ImpersonationBanner() {
  const { user } = useAuth()
  const { stopImpersonation, getImpersonationData, isImpersonating } =
    useImpersonation()

  // Initialize with null to avoid hydration issues
  const [impersonationData, setImpersonationData] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  // First useEffect to handle client-side mounting
  useEffect(() => {
    setIsClient(true)
    // Check impersonation data once client-side is ready
    const data = getImpersonationData()
    setImpersonationData(data)

    // Add CSS class for impersonation styling
    if (data) {
      document.body.classList.add('impersonation-active')
      document.body.style.setProperty('--impersonation-offset', '44px')
    } else {
      document.body.classList.remove('impersonation-active')
      document.body.style.removeProperty('--impersonation-offset')
    }
  }, []) // Empty dependency array - only run once on mount

  // Second useEffect for storage change listener
  useEffect(() => {
    if (!isClient) return

    const updateImpersonationState = () => {
      const data = getImpersonationData()
      setImpersonationData(data)

      if (data) {
        document.body.classList.add('impersonation-active')
        document.body.style.setProperty('--impersonation-offset', '44px')
      } else {
        document.body.classList.remove('impersonation-active')
        document.body.style.removeProperty('--impersonation-offset')
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === IMPERSONATION_DATA_KEY) {
        updateImpersonationState()
      }
    }

    const handleImpersonationEvent = (_event: Event) => {
      updateImpersonationState()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(IMPERSONATION_EVENT, handleImpersonationEvent)

    return () => {
      document.body.classList.remove('impersonation-active')
      document.body.style.removeProperty('--impersonation-offset')
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(IMPERSONATION_EVENT, handleImpersonationEvent)
    }
  }, [isClient, getImpersonationData]) // Stable dependencies

  // Keep layout offset aligned with the rendered banner height
  useEffect(() => {
    if (!isClient) return

    if (!impersonationData) {
      document.body.style.removeProperty('--impersonation-offset')
      return
    }

    const applyOffset = () => {
      const height = bannerRef.current?.offsetHeight ?? 0
      if (height > 0) {
        document.body.style.setProperty(
          '--impersonation-offset',
          `${height}px`
        )
      }
    }

    const frameId = requestAnimationFrame(applyOffset)
    window.addEventListener('resize', applyOffset)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', applyOffset)
    }
  }, [impersonationData, isClient])

  if (!isImpersonating() || !impersonationData) {
    return null // Don't render anything if not in impersonation mode
  }

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 bg-yellow-400 text-black p-2 text-center text-sm z-50 border-b-2 border-yellow-600"
    >
      <div className="flex items-center justify-center">
        <span className="mr-2">⚠️</span>
        <span>
          Viewing as <strong>{impersonationData.target_user?.email}</strong>
          {impersonationData.admin_user && (
            <span className="ml-1 text-xs opacity-75">
              (Admin: {impersonationData.admin_user.email})
            </span>
          )}
        </span>
        <button
          onClick={stopImpersonation}
          className="ml-4 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium text-xs"
        >
          Return to Admin View
        </button>
      </div>
    </div>
  )
}
