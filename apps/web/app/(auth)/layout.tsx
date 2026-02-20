import type { Metadata } from 'next'

export const metadata = {
  title: 'SAT Practice - Authentication',
  description: 'Sign in to access your SAT mock exams and practice tests',
} satisfies Metadata

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
