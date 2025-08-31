import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SAT Practice - Authentication',
  description: 'Sign in to access your SAT mock exams and practice tests',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}