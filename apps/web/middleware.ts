import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Try to get session with better error handling
  let session = null
  try {
    const { data: { session: sessionData }, error } = await supabase.auth.getSession()
    if (error) {
      console.log(`⚠️ Middleware: Session error:`, error.message)
    }
    session = sessionData
  } catch (error) {
    console.log(`⚠️ Middleware: Failed to get session:`, error)
  }

  const { pathname } = req.nextUrl
  console.log(`🛡️ Middleware: ${pathname}, session:`, session ? `${session.user.email}` : 'null')
  
  // Try to refresh session if null but we expect there to be one
  if (!session && (pathname.startsWith('/student') || pathname.startsWith('/admin'))) {
    try {
      console.log(`🔄 Middleware: Attempting to refresh session for ${pathname}`)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (user && !error) {
        console.log(`✅ Middleware: Found user after refresh: ${user.email}`)
        // Create a fresh session check
        const { data: { session: refreshedSession } } = await supabase.auth.getSession()
        session = refreshedSession
      }
    } catch (error) {
      console.log(`❌ Middleware: Session refresh failed:`, error)
    }
  }

  // Get user profile if session exists
  const { data: profile } = session ? await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single() : { data: null }

  const userRole = profile?.role

  // If user is not logged in...
  if (!session) {
    // and trying to access any protected route, redirect to login
    if (!pathname.startsWith('/login') && !pathname.startsWith('/signup') && pathname !== '/') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return res // Allow access to login/signup/home
  }

  // If user IS logged in...
  // and trying to access login/signup, redirect to their dashboard
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    const redirectUrl = userRole === 'admin' ? '/admin/dashboard' : '/student/dashboard'
    console.log(`🔄 Middleware: Redirecting logged-in user from ${pathname} to ${redirectUrl}`)
    return NextResponse.redirect(new URL(redirectUrl, req.url))
  }

  // Protect admin routes
  if (pathname.startsWith('/admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/student/dashboard', req.url))
  }

  // Protect student routes (admins are allowed)
  if (pathname.startsWith('/student') && userRole !== 'student' && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If all checks pass, allow the request to proceed
  return res
}

export const config = {
  matcher: [
    // Temporarily disable middleware to fix session sync issues
    // '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
