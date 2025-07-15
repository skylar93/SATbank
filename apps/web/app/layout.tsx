import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../contexts/auth-context'
import { SidebarProvider } from '../contexts/sidebar-context'
import { RouteGuard } from '../components/route-guard'
import { Sidebar } from '../components/sidebar'

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
          <SidebarProvider>
            <RouteGuard>
              <div className="flex h-screen bg-gray-50">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </RouteGuard>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}