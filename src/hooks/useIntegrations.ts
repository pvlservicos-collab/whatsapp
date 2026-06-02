'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Integration } from '@/lib/types'

export function useIntegrations(organizationId: string) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await supabase
          .from('integrations')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('name', { ascending: true })

        if (err) {
          // If table doesn't exist or permission error, silently fail with empty integrations
          console.warn('[useIntegrations] Could not fetch integrations:', err.message)
          setIntegrations([])
          setError(null) // Don't treat as error
          setLoading(false)
          return
        }

        setIntegrations((data as Integration[]) || [])
      } catch (err) {
        console.warn('[useIntegrations] Fetch failed:', err)
        setIntegrations([])
        setError(null) // Don't treat as critical error
      } finally {
        setLoading(false)
      }
    }

    fetchIntegrations()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`integrations:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrations',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchIntegrations()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [organizationId])

  return {
    integrations,
    loading,
    error,
  }
}
