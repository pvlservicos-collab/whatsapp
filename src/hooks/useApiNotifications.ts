'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAuth } from './useAuth'

export interface ApiNotificationEvent {
    id: string
    eventId: string
    label: string
    description?: string
    iconName: string
    enabled: boolean
    color: string
}

const SETTINGS_KEY = 'api_notifications'

export function useApiNotifications() {
    const { organizationId } = useAuth()
    const [events, setEvents] = useState<ApiNotificationEvent[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSettings = useCallback(async () => {
        if (!organizationId) return
        try {
            const { data } = await supabase
                .from('automation_settings')
                .select('variables')
                .eq('organization_id', organizationId)
                .eq('key', SETTINGS_KEY)
                .single()

            if (data?.variables && Array.isArray(data.variables)) {
                setEvents(data.variables)
            }
        } catch {
            // No settings found, use defaults or empty
        } finally {
            setLoading(false)
        }
    }, [organizationId])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const saveEvents = async (newEvents: ApiNotificationEvent[]) => {
        if (!organizationId) return
        setEvents(newEvents) // Optimistic update

        const { error } = await supabase
            .from('automation_settings')
            .upsert({
                organization_id: organizationId,
                key: SETTINGS_KEY,
                is_enabled: true,
                variables: newEvents,
            }, {
                onConflict: 'organization_id,key'
            })

        if (error) {
            console.error('Failed to save API notifications:', error)
            fetchSettings() // Revert
        }
    }

    return { events, loading, saveEvents }
}
