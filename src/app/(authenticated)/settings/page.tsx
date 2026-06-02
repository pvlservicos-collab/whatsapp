import { redirect } from 'next/navigation'

export default function SettingsRootPage() {
    // Redirect to the default settings page
    redirect('/settings/organization')
}
