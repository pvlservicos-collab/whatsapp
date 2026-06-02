'use client'

import { usePathname } from 'next/navigation'
import SettingsSidebar from './SettingsSidebar'
import SettingsAccessGuard from '@/components/Settings/SettingsAccessGuard'

export default function SettingsLayoutWrapper({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    // If the user is on the User Profile settings, do NOT show the organizational settings sidebar
    if (pathname === '/settings/profile') {
        return (
            <div className="bg-gray-50 min-h-[calc(100vh-3.5rem)]">
                <main className="p-8 lg:p-12 xl:p-16 overflow-y-auto w-full flex justify-center">
                    <div className="w-full max-w-4xl">
                        {children}
                    </div>
                </main>
            </div>
        )
    }

    return (
        <SettingsAccessGuard>
            <div className="flex bg-gray-50 min-h-[calc(100vh-3.5rem)]">
                {/* Sidebar Navigation */}
                <aside className="w-64 border-r border-gray-200 bg-white min-h-[calc(100vh-3.5rem)]">
                    <div className="p-4">
                        <SettingsSidebar />
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-8 lg:p-12 xl:p-16 overflow-y-auto">
                    <div className="max-w-3xl">
                        {children}
                    </div>
                </main>
            </div>
        </SettingsAccessGuard>
    )
}
