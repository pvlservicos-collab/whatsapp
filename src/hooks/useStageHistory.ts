'use client'

import { useEffect, useState } from 'react'
import { LeadStageHistory } from '@/lib/types'

export function useStageHistory(leadId: string) {
  const [history, setHistory] = useState<LeadStageHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) { setLoading(false); return }
    fetchHistory()
  }, [leadId])

  async function fetchHistory() {
    try {
      setLoading(true)
      const res = await fetch(`/api/leads/${leadId}/stage-history`)
      if (!res.ok) { setHistory([]); return }
      const { data } = await res.json()
      setHistory(data || [])
    } catch (err) {
      console.error('Failed to fetch stage history:', err)
    } finally {
      setLoading(false)
    }
  }

  return { history, loading }
}
