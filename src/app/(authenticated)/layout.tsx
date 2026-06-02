'use client'

import Navbar from '@/components/Shared/Navbar'
import { FilterProvider } from '@/contexts/FilterContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { LeadsProvider } from '@/contexts/LeadsContext'
import { AuthProvider } from '@/contexts/AuthContext'
import AuthGuard from '@/components/Auth/AuthGuard'

/**
 * Layout for all authenticated pages (pipeline, chat, settings, etc.)
 * Wraps children with AuthGuard (redirects if not logged in) and Navbar.
 */
export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <AuthProvider>
                <FilterProvider>
                    <NotificationProvider>
                        <LeadsProvider>
                            <div className="flex flex-col h-screen bg-gray-50">
                                <Navbar />
                                <main className="flex-1 overflow-auto scrollbar-hide">
                                    {children}
                                </main>
                            </div>
                        </LeadsProvider>
                    </NotificationProvider>
                </FilterProvider>
            </AuthProvider>
        </AuthGuard>
    )
}
