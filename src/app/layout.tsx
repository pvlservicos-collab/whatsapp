import type { Metadata } from 'next'
import '@/globals.css'
import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from '@/contexts/AuthContext'
import { NotificationProvider } from '@/contexts/NotificationContext'

export const metadata: Metadata = {
  title: 'Atlas Eye CRM',
  description: 'Sales CRM with AI Insights and Real-time Collaboration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 font-sans" suppressHydrationWarning>
        <SessionProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
