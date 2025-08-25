import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../contexts/auth-context'
import { SidebarProvider } from '../contexts/sidebar-context'
import { RouteGuard } from '../components/route-guard'
import { Sidebar } from '../components/sidebar'
import { ImpersonationBanner } from '../components/admin/ImpersonationBanner'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
})

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
      <body className={nunito.className}>
        <AuthProvider>
          <SidebarProvider>
            <RouteGuard>
              <ImpersonationBanner />
              <div className="flex h-screen bg-gray-50">
                <Sidebar />
                <div className="flex-1 overflow-auto">{children}</div>
              </div>
            </RouteGuard>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
