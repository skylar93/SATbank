'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../contexts/auth-context'
import { useImpersonation } from '../hooks/use-impersonation'

interface RouteGuardProps {
  children: React.ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, loading, isAdmin, isStudent } = useAuth()
  const { isImpersonating, getImpersonationData } = useImpersonation()
  const router = useRouter()
  const pathname = usePathname()

  // Get effective role considering impersonation
  const effectiveIsAdmin = isImpersonating() ? false : isAdmin
  const effectiveIsStudent = isImpersonating() ? true : isStudent

  useEffect(() => {
    if (loading) return // Wait for auth to load

    // Prevent route guard actions during impersonation transitions
    const isTransitioning = typeof window !== 'undefined' && 
      window.location.href.includes('/admin/students') && 
      localStorage.getItem('impersonation_data')
    
    if (isTransitioning) {
      console.log('🔄 RouteGuard: In transition, skipping route changes')
      return
    }

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/']
    const isPublicRoute = publicRoutes.includes(pathname)

    // If not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
      // Add a small delay to prevent race conditions with auth loading
      const redirectTimer = setTimeout(() => {
        console.log('🛡️ RouteGuard: Redirecting unauthenticated user to login')
        router.push('/login')
      }, 100)
      
      // Cleanup timer if component unmounts
      return () => clearTimeout(redirectTimer)
    }

    // If authenticated but on login/signup, redirect to appropriate dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
      console.log(
        '🛡️ RouteGuard: Authenticated user on auth page, redirecting...'
      )
      if (effectiveIsAdmin) {
        router.push('/admin/dashboard')
      } else if (effectiveIsStudent) {
        router.push('/student/dashboard')
      }
      return
    }

    // Admin route protection - don't redirect if impersonating
    if (user && pathname.startsWith('/admin') && !effectiveIsAdmin && !isImpersonating()) {
      console.log('🛡️ RouteGuard: Non-admin trying to access admin route')
      router.push('/student/dashboard')
      return
    }

    // Student route protection - allow access if impersonating or if student
    if (user && pathname.startsWith('/student') && !effectiveIsStudent) {
      // Allow admins to access exam routes in preview mode (when not impersonating)
      const isExamPreview =
        pathname.startsWith('/student/exam/') &&
        new URL(window.location.href).searchParams.get('preview') === 'true' &&
        isAdmin

      if (!isExamPreview && !isImpersonating()) {
        console.log('🛡️ RouteGuard: Non-student trying to access student route')
        router.push('/admin/dashboard')
        return
      } else if (isExamPreview || isImpersonating()) {
        console.log('🛡️ RouteGuard: Allowing admin exam preview or impersonation')
      }
    }
  }, [user, loading, isAdmin, isStudent, effectiveIsAdmin, effectiveIsStudent, pathname, router, isImpersonating])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
