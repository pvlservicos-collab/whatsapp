'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { LeadActivityWithActor } from '@/lib/types'

export function useTimeline(leadId: string) {
  const [activities, setActivities] = useState<LeadActivityWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leadId) return

    async function fetchActivities() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await supabase
          .from('lead_activities')
          .select(
            `*,
            actor:organization_members!actor_member_id(
              profiles(full_name, avatar_url)
            )`
          )
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true })

        if (err) throw err

        setActivities(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch activities')
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()

    // Setup realtime subscription
    const channel = supabase
      .channel(`timeline:${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_activities',
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          setActivities((prev) => [...prev, payload.new as LeadActivityWithActor])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [leadId])

  const addActivity = useCallback(
    async (
      organizationId: string,
      type: 'whatsapp' | 'note' | 'call' | 'email' | 'system',
      content: string,
      actorMemberId: string,
      metadata?: Record<string, any>
    ) => {
      try {
        const { data, error: err } = await supabase
          .from('lead_activities')
          .insert({
            organization_id: organizationId,
            lead_id: leadId,
            actor_member_id: actorMemberId,
            type,
            content,
            metadata,
          })
          .select(
            `*,
            actor:organization_members!actor_member_id(
              profiles(full_name, avatar_url)
            )`
          )
          .single()

        if (err) throw err

        setActivities((prev) => [...prev, data as LeadActivityWithActor])
        return data
      } catch (err) {
        console.error('Failed to add activity:', err)
        throw err
      }
    },
    [leadId]
  )

  return {
    activities,
    loading,
    error,
    addActivity,
  }
}
