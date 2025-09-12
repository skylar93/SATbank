'use client'
import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const IMPERSONATION_DATA_KEY = 'impersonation_data'

export function useImpersonation() {
  const router = useRouter()

  const startImpersonation = async (targetUserId: string) => {
    try {
      // Call the Edge Function to get impersonation data
      const { data: impersonationData, error } =
        await supabase.functions.invoke('impersonate-user', {
          body: { targetUserId },
        })

      if (error) throw new Error(error.message)

      // Store impersonation data in localStorage first
      localStorage.setItem(
        IMPERSONATION_DATA_KEY,
        JSON.stringify(impersonationData)
      )

      // Dispatch a custom event to trigger immediate state updates
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: IMPERSONATION_DATA_KEY,
          newValue: JSON.stringify(impersonationData),
          oldValue: null,
          storageArea: localStorage,
          url: window.location.href,
        })
      )

      // Apply padding in a way that ensures it's present during navigation
      requestAnimationFrame(() => {
        document.body.style.setProperty('padding-top', '44px', 'important')
        document.body.classList.add('impersonation-active')

        // Navigate immediately after applying styles - but NOT if we're already on a student page
        if (!window.location.pathname.startsWith('/student/')) {
          router.push('/student/dashboard')
        }
      })
    } catch (error: any) {
      console.error('Failed to start impersonation:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const stopImpersonation = async () => {
    try {
      // Clear impersonation data
      localStorage.removeItem(IMPERSONATION_DATA_KEY)

      // Remove body padding immediately
      document.body.style.setProperty('padding-top', '0px', 'important')
      document.body.classList.remove('impersonation-active')

      // Force reload to properly reset auth state and prevent infinite loading
      window.location.href = '/admin/students'
    } catch (error: any) {
      console.error('Failed to stop impersonation:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const getImpersonationData = useCallback(() => {
    if (typeof window === 'undefined') return null

    const dataJSON = localStorage.getItem(IMPERSONATION_DATA_KEY)
    if (!dataJSON) return null

    try {
      return JSON.parse(dataJSON)
    } catch {
      return null
    }
  }, [])

  const isImpersonating = useCallback(() => {
    return getImpersonationData() !== null
  }, [getImpersonationData])

  return {
    startImpersonation,
    stopImpersonation,
    getImpersonationData,
    isImpersonating,
  }
}
