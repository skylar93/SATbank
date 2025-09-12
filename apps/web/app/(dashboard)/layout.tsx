import type { Metadata } from 'next'
import { SidebarProvider } from '../../contexts/sidebar-context'
import { Sidebar } from '../../components/sidebar'
import { ImpersonationBanner } from '../../components/admin/ImpersonationBanner'

export const metadata: Metadata = {
  title: 'SAT Practice - Dashboard',
  description: 'Access your SAT mock exams and practice tests',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ImpersonationBanner />
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </SidebarProvider>
  )
}
