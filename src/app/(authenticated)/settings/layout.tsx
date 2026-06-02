import { Metadata } from 'next'
import SettingsLayoutWrapper from './SettingsLayoutWrapper'

export const metadata: Metadata = {
    title: 'Configurações | Atlas Eye',
    description: 'Manage your organization settings, pipelines, and more.',
}

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <SettingsLayoutWrapper>{children}</SettingsLayoutWrapper>
}
