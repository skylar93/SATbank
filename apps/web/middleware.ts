import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log('🔄 Middleware: Processing request to:', req.nextUrl.pathname)
  
  const res = NextResponse.next()
  
  // TEMPORARILY DISABLED: Session sync issue between middleware and client auth
  // Using client-side protection instead
  
  /*
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session to ensure it's synced
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('🔄 Middleware: Session exists:', !!session, session?.user?.email)

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  console.log('🔄 Middleware: Is public route:', isPublicRoute)

  // If no session and trying to access protected route, redirect to login
  if (!session && !isPublicRoute) {
    console.log('🔄 Middleware: No session for protected route, redirecting to login')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If session exists and trying to access login/signup, redirect based on role
  if (session && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    console.log('🔄 Middleware: User has session on login/signup page, checking profile...')
    
    try {
      // Get user profile to determine role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      console.log('🔄 Middleware: Profile data:', profile, 'Error:', profileError)

      if (profile?.role === 'admin') {
        console.log('🔄 Middleware: Redirecting admin to /admin/dashboard')
        return NextResponse.redirect(new URL('/admin/dashboard', req.url))
      } else if (profile?.role === 'student') {
        console.log('🔄 Middleware: Redirecting student to /student/dashboard')
        return NextResponse.redirect(new URL('/student/dashboard', req.url))
      }
    } catch (error) {
      console.error('🔄 Middleware: Error fetching profile:', error)
      // Continue to allow access if profile fetch fails
    }
  }

  // Admin route protection
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      console.log('🔄 Middleware: No session for admin route, redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        console.log('🔄 Middleware: Non-admin trying to access admin route, redirecting to student dashboard')
        return NextResponse.redirect(new URL('/student/dashboard', req.url))
      }
    } catch (error) {
      console.error('🔄 Middleware: Error checking admin role:', error)
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Student route protection
  if (req.nextUrl.pathname.startsWith('/student')) {
    if (!session) {
      console.log('🔄 Middleware: No session for student route, redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'admin') {
        console.log('🔄 Middleware: Admin trying to access student route, redirecting to admin dashboard')
        return NextResponse.redirect(new URL('/admin/dashboard', req.url))
      }
    } catch (error) {
      console.error('🔄 Middleware: Error checking student role:', error)
      // Allow access for students even if profile check fails
    }
  }
  */

  console.log('🔄 Middleware: Allowing request to proceed to:', req.nextUrl.pathname)
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}