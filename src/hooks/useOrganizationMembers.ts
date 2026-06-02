'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { OrganizationMemberWithProfile } from '@/lib/types'

export function useOrganizationMembers(organizationId: string) {
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMembers() {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error("Não autenticado")

        const response = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }

        const membersList = await response.json()
        setMembers(membersList)
      } catch (err: any) {
        console.warn('[useOrganizationMembers] Fetch failed:', err)
        setMembers([])
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`org_members:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_members',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchMembers()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [organizationId])

  return {
    members,
    loading,
    error,
  }
}
