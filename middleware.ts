import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const { pathname } = req.nextUrl

    // If user is logged in
    if (session) {
      // Redirect from auth pages to dashboard
      if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        const redirectUrl = profile?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'
        return NextResponse.redirect(new URL(redirectUrl, req.url))
      }
      return res
    }

    // If user is NOT logged in, protect dashboard routes
    const isProtectedRoute = pathname.startsWith('/student') || pathname.startsWith('/admin')
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
  } catch (error) {
    console.error('Middleware auth error:', error)
    return res
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}