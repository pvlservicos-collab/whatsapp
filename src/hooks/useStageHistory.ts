'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { LeadStageHistory } from '@/lib/types'

export function useStageHistory(leadId: string) {
  const [history, setHistory] = useState<LeadStageHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) {
      setLoading(false)
      return
    }

    async function fetchHistory() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('lead_stage_history')
          .select('*')
          .eq('lead_id', leadId)
          .order('changed_at', { ascending: true })

        if (error) throw error
        setHistory(data || [])
      } catch (err) {
        console.error('Failed to fetch stage history:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()

    const channel = supabase
      .channel(`public:lead_stage_history:${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'lead_stage_history',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId])

  return { history, loading }
}
