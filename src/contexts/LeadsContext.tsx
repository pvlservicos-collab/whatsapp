'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { LeadWithOwner } from '@/lib/types'
import { useAuth } from '@/hooks'
import { usePusherChannel } from '@/hooks/usePusher'

interface StageStats {
  count: number
  totalValue: number
}

interface LeadsContextType {
  leads: LeadWithOwner[]
  setLeads: React.Dispatch<React.SetStateAction<LeadWithOwner[]>>
  loading: boolean
  error: string | null
  stageStats: Record<string, StageStats>
  moveLeadToStage: (leadId: string, newStageId: string, oldStageId?: string, memberId?: string) => Promise<void>
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined)

export function LeadsProvider({ children }: { children: ReactNode }) {
  const { currentOrganization, permissions } = useAuth()
  const [leads, setLeads] = useState<LeadWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageStats, setStageStats] = useState<Record<string, StageStats>>({})

  const organizationId = currentOrganization?.organization_id

  async function fetchLeads() {
    if (!organizationId) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const viewOwnOnly = permissions?.leads?.view_own_only
      const memberId = currentOrganization?.id
      const params = new URLSearchParams({ returnAll: 'true', exclude_groups: 'true' })
      if (viewOwnOnly && memberId) params.set('owner', memberId)
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Failed to fetch leads')
      const { data } = await res.json()
      setLeads(data || [])

      // Compute stage stats
      const stats: Record<string, StageStats> = {}
      for (const lead of (data || [])) {
        if (!lead.stage_id) continue
        if (!stats[lead.stage_id]) stats[lead.stage_id] = { count: 0, totalValue: 0 }
        stats[lead.stage_id].count++
        stats[lead.stage_id].totalValue += lead.value || 0
      }
      setStageStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [organizationId, currentOrganization?.id])

  // Real-time via Pusher
  usePusherChannel(
    organizationId ? `org-${organizationId}` : '',
    {
      'lead.created': () => fetchLeads(),
      'lead.updated': (data: any) => {
        if (data?.id) {
          setLeads(prev => {
            const updated = prev.map(l => l.id === data.id
              ? { ...l, ...data, last_activity_at: data.last_activity_at || new Date().toISOString() }
              : l)
            return [...updated].sort((a, b) => {
              const ta = new Date(a.last_activity_at || a.created_at).getTime()
              const tb = new Date(b.last_activity_at || b.created_at).getTime()
              return tb - ta
            })
          })
        } else {
          fetchLeads()
        }
      },
      'lead.deleted': (data: any) => {
        if (data?.id) setLeads(prev => prev.filter(l => l.id !== data.id))
      },
    }
  )

  const moveLeadToStage = useCallback(
    async (leadId: string, newStageId: string, oldStageId?: string) => {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: newStageId } : l))
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: newStageId }),
        })
        if (!res.ok) throw new Error('Failed to update lead stage')
      } catch (err) {
        console.error('Failed to update lead stage:', err)
        if (oldStageId) {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: oldStageId } : l))
        }
        throw err
      }
    },
    []
  )

  return (
    <LeadsContext.Provider value={{ leads, setLeads, loading, error, stageStats, moveLeadToStage }}>
      {children}
    </LeadsContext.Provider>
  )
}

export function useLeadsContext() {
  const context = useContext(LeadsContext)
  if (context === undefined) throw new Error('useLeadsContext must be used within a LeadsProvider')
  return context
}
