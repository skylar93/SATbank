'use client'

import Link from 'next/link'
import { useAuth } from '../contexts/auth-context'

export function Navigation() {
  const { user, signOut, isAdmin, isStudent } = useAuth()

  if (!user) return null

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center min-w-0 flex-1">
            <Link
              href={isAdmin ? '/admin/dashboard' : '/student/dashboard'}
              className="flex-shrink-0"
            >
              <h1 className="text-lg md:text-xl font-bold text-blue-600">
                SAT Practice
              </h1>
            </Link>

            <div className="ml-4 md:ml-10 flex items-baseline space-x-2 md:space-x-4 overflow-x-auto">
              {isAdmin ? (
                <>
                  <Link
                    href="/admin/dashboard"
                    className="text-gray-500 hover:text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/admin/students"
                    className="text-gray-500 hover:text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Students
                  </Link>
                  <Link
                    href="/admin/reports"
                    className="text-gray-500 hover:text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Reports
                  </Link>
                  <Link
                    href="/admin/exams"
                    className="text-gray-500 hover:text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Exams
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/student/dashboard"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/student/exams"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Take Exam
                  </Link>
                  <Link
                    href="/student/results"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Results
                  </Link>
                  {/* <Link
                    href="/student/recommendations"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Study Plan
                  </Link> */}
                  {/* <Link
                    href="/student/problem-bank"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Problem Bank
                  </Link> */}
                  <Link
                    href="/student/settings"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Settings
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
            <div className="text-xs md:text-sm text-gray-500 hidden sm:block">
              <span className="font-medium">{user.profile?.full_name}</span>
              {isAdmin && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  Admin
                </span>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
