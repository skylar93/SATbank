import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Safety Switch: Check for an environment variable to disable the middleware.
  // This is useful for debugging.
  if (process.env.NEXT_PUBLIC_DISABLE_MIDDLEWARE === 'true') {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // This single line is crucial. It refreshes the session cookie on every navigation.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');

  // If the user is logged in (session exists)...
  if (session) {
    // and they are trying to access an auth page, redirect them to the student dashboard.
    if (isAuthPage) {
      return NextResponse.redirect(new URL('/student/dashboard', req.url));
    }
  } 
  // If the user is NOT logged in...
  else {
    // and they are trying to access any page that is NOT an auth page, redirect to login.
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Allow the request to proceed.
  return res;
}

// This config ensures the middleware runs on all paths except for static assets.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};