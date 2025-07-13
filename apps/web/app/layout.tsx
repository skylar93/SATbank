import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../contexts/auth-context'
import { RouteGuard } from '../components/route-guard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SAT Mock Exam & Problem Bank',
  description: 'Practice SAT exams and improve your scores',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <RouteGuard>
            {children}
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  )
}