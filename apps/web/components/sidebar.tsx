'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../contexts/auth-context'
import { useSidebar } from '../contexts/sidebar-context'
import { useImpersonation } from '../hooks/use-impersonation'
import { supabase } from '../lib/supabase'
import {
  ChartBarIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  CogIcon,
  UserCircleIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  LanguageIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

const QUICK_TEST_EMAIL = 'indeliblefantasy@gmail.com'

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const studentNavigationItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/student/dashboard', icon: ChartBarIcon },
  { name: 'Take Exam', href: '/student/exams', icon: DocumentTextIcon },
  {
    name: 'Results',
    href: '/student/results',
    icon: ClipboardDocumentListIcon,
  },
  { name: 'Vocabulary', href: '/student/vocab', icon: LanguageIcon },
  // { name: 'Study Plan', href: '/student/recommendations', icon: CalendarDaysIcon },
  {
    name: 'Mistake Notebook',
    href: '/student/mistake-notebook',
    icon: BookOpenIcon,
  },
  { name: 'Settings', href: '/student/settings', icon: CogIcon },
]

const adminNavigationItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: ChartBarIcon },
  { name: 'Students', href: '/admin/students', icon: UserCircleIcon },
  { name: 'Assignments', href: '/admin/assignments', icon: AcademicCapIcon },
  { name: 'Reports', href: '/admin/reports', icon: ClipboardDocumentListIcon },
  { name: 'Exam Management', href: '/admin/exams', icon: Cog6ToothIcon },
  { name: 'Question Bank', href: '/admin/questions', icon: DocumentTextIcon },
]

export function Sidebar() {
  const { user, signOut, isAdmin } = useAuth()
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar()
  const pathname = usePathname()

  const navigationItems = isAdmin
    ? adminNavigationItems
    : studentNavigationItems

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (!user) return null

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent
              navigationItems={navigationItems}
              pathname={pathname}
              user={user}
              isAdmin={isAdmin}
              handleSignOut={handleSignOut}
              isSidebarOpen={true}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex md:flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}
      >
        <SidebarContent
          navigationItems={navigationItems}
          pathname={pathname}
          user={user}
          isAdmin={isAdmin}
          handleSignOut={handleSignOut}
          isSidebarOpen={isSidebarOpen}
        />
      </div>
    </>
  )
}

interface SidebarContentProps {
  navigationItems: SidebarItem[]
  pathname: string
  user: any
  isAdmin: boolean
  handleSignOut: () => void
  isSidebarOpen: boolean
}

function SidebarContent({
  navigationItems,
  pathname,
  user,
  isAdmin,
  handleSignOut,
  isSidebarOpen,
}: SidebarContentProps) {
  const { setIsSidebarOpen } = useSidebar()
  const { startImpersonation } = useImpersonation()
  const [quickStudent, setQuickStudent] = useState<{
    id: string
    name: string | null
  } | null>(null)
  const [quickImpersonationLoading, setQuickImpersonationLoading] =
    useState(false)

  const handleQuickImpersonation = async () => {
    if (quickImpersonationLoading) return

    try {
      setQuickImpersonationLoading(true)

      let student = quickStudent

      if (!student) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('role', 'student')
          .eq('email', QUICK_TEST_EMAIL)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error(
            `No student account found for ${QUICK_TEST_EMAIL}. Please verify the email.`
          )
        }

        student = { id: data.id, name: data.full_name ?? null }
        setQuickStudent(student)
      }

      await startImpersonation(student.id)
    } catch (error: unknown) {
      console.error('Quick impersonation failed:', error)
      alert(
        error instanceof Error
          ? error.message
          :
          'Failed to start impersonation. Please try again or check the console for details.'
      )
    } finally {
      setQuickImpersonationLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full bg-white border-r border-gray-100 shadow-sm overflow-x-visible">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
        <Link
          href={isAdmin ? '/admin/dashboard' : '/student/dashboard'}
          className="flex items-center"
        >
          <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          {isSidebarOpen && (
            <span className="ml-3 text-gray-900 font-semibold text-lg">
              SAT Practice
            </span>
          )}
        </Link>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? (
            <ChevronLeftIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-visible">
        {navigationItems.map((item) => {
          // Check if current path matches exactly or starts with the base path
          const isActive =
            pathname === item.href ||
            (item.href === '/admin/exams' &&
              pathname.startsWith('/admin/exams/') &&
              pathname !== '/admin/questions') ||
            (item.href === '/admin/questions' &&
              pathname === '/admin/questions') ||
            (item.href === '/student/vocab' &&
              pathname.startsWith('/student/vocab'))
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`
                group relative flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200
                ${
                  isActive
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
                ${!isSidebarOpen ? 'justify-center' : ''}
              `}
            >
              <IconComponent
                className={`flex-shrink-0 w-5 h-5 ${!isSidebarOpen ? '' : 'mr-3'}`}
              />
              {isSidebarOpen && <span>{item.name}</span>}
              {!isSidebarOpen && (
                <div className="fixed left-20 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg pointer-events-none">
                  {item.name}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 p-3 border-t border-gray-100 overflow-hidden">
        <div
          className={`flex ${isSidebarOpen ? 'items-center' : 'flex-col items-center space-y-2'}`}
        >
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">
              {user.profile?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          {isSidebarOpen ? (
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.profile?.full_name || 'User'}
                  </p>
                  {isAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 mt-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <button
                      onClick={handleQuickImpersonation}
                      disabled={quickImpersonationLoading}
                      aria-label={`View as ${QUICK_TEST_EMAIL}`}
                      title={`Open student view as ${QUICK_TEST_EMAIL}`}
                      className={`text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg p-1 transition-colors ${
                        quickImpersonationLoading ? 'opacity-60 cursor-wait' : ''
                      }`}
                    >
                      <EyeIcon
                        className={`w-4 h-4 ${
                          quickImpersonationLoading ? 'animate-pulse' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors flex-shrink-0"
                  >
                    <span className="sr-only">Sign out</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleQuickImpersonation}
                  disabled={quickImpersonationLoading}
                  aria-label={`View as ${QUICK_TEST_EMAIL}`}
                  title={`Open student view as ${QUICK_TEST_EMAIL}`}
                  className={`text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg p-1 transition-colors ${
                    quickImpersonationLoading ? 'opacity-60 cursor-wait' : ''
                  }`}
                >
                  <EyeIcon
                    className={`w-4 h-4 ${
                      quickImpersonationLoading ? 'animate-pulse' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors flex-shrink-0"
              >
                <span className="sr-only">Sign out</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MobileMenuButton() {
  const { setIsSidebarOpen } = useSidebar()

  return (
    <button
      type="button"
      className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500"
      onClick={() => setIsSidebarOpen(true)}
    >
      <Bars3Icon className="h-6 w-6" />
    </button>
  )
}

export function MobileTopBar() {
  const pathname = usePathname()

  // Hide on exam pages — ExamInterface has its own header
  if (pathname.match(/\/exam\//)) return null

  return (
    <div className="md:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100/70 px-4 py-2.5 flex items-center gap-3 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
      <MobileMenuButton />
      <span className="text-sm font-semibold text-gray-800">SAT Practice</span>
    </div>
  )
}
