'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../contexts/auth-context'

interface RouteGuardProps {
  children: React.ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, loading, isAdmin, isStudent } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return // Wait for auth to load

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/']
    const isPublicRoute = publicRoutes.includes(pathname)

    // If not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
      console.log('🛡️ RouteGuard: Redirecting unauthenticated user to login')
      router.push('/login')
      return
    }

    // If authenticated but on login/signup, redirect to appropriate dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
      console.log('🛡️ RouteGuard: Authenticated user on auth page, redirecting...')
      if (isAdmin) {
        router.push('/admin/dashboard')
      } else if (isStudent) {
        router.push('/student/dashboard')
      }
      return
    }

    // Admin route protection
    if (user && pathname.startsWith('/admin') && !isAdmin) {
      console.log('🛡️ RouteGuard: Non-admin trying to access admin route')
      router.push('/student/dashboard')
      return
    }

    // Student route protection - but allow admins to preview exams
    if (user && pathname.startsWith('/student') && !isStudent) {
      // Allow admins to access exam routes in preview mode
      const isExamPreview = pathname.startsWith('/student/exam/') && 
                           new URL(window.location.href).searchParams.get('preview') === 'true' && 
                           isAdmin
      
      if (!isExamPreview) {
        console.log('🛡️ RouteGuard: Non-student trying to access student route')
        router.push('/admin/dashboard')
        return
      } else {
        console.log('🛡️ RouteGuard: Allowing admin exam preview')
      }
    }

  }, [user, loading, isAdmin, isStudent, pathname, router])

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