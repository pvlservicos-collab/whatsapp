'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
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
  refetch: () => Promise<void>
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined)

export function LeadsProvider({ children }: { children: ReactNode }) {
  const { currentOrganization, permissions } = useAuth()
  const [leads, setLeads] = useState<LeadWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageStats, setStageStats] = useState<Record<string, StageStats>>({})

  const organizationId = currentOrganization?.organization_id

  async function fetchLeads(showLoading = true) {
    if (!organizationId) { setLoading(false); return }
    try {
      if (showLoading) setLoading(true)
      setError(null)
      const viewOwnOnly = permissions?.leads?.view_own_only
      const memberId = currentOrganization?.id
      // Grupos entram na lista (o Chat precisa deles); quem não quer ver grupo
      // (Pipeline) já filtra por conta própria em PipelineBoard.tsx.
      const params = new URLSearchParams({ returnAll: 'true' })
      if (viewOwnOnly && memberId) params.set('owner', memberId)
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Failed to fetch leads')
      const { data } = await res.json()
      setLeads(data || [])

      // Compute stage stats — grupo não conta pra estatística do Pipeline
      const stats: Record<string, StageStats> = {}
      for (const lead of (data || [])) {
        if (!lead.stage_id || lead.is_group) continue
        if (!stats[lead.stage_id]) stats[lead.stage_id] = { count: 0, totalValue: 0 }
        stats[lead.stage_id].count++
        stats[lead.stage_id].totalValue += lead.value || 0
      }
      setStageStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [organizationId, currentOrganization?.id])

  // Um evento `lead.updated`/`lead.created` chega no canal da organização inteira
  // pra TODO admin conectado — sem agrupar rajadas (várias mensagens em segundos),
  // cada evento disparava um refetch completo por sessão aberta, multiplicando
  // consultas ao banco e contribuindo pra esgotar o pool de conexões quando várias
  // pessoas estão logadas ao mesmo tempo. Agrupa numa janela curta antes de refazer
  // a consulta; `lead.deleted` (só filtro local) e `__reconnected` continuam imediatos.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFetchLeads = () => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null
      fetchLeads(false)
    }, 500)
  }
  useEffect(() => () => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
  }, [])

  // Real-time via Pusher
  usePusherChannel(
    organizationId ? `org-${organizationId}` : '',
    {
      'lead.created': scheduleFetchLeads,
      'lead.updated': scheduleFetchLeads,
      'lead.deleted': (data: any) => {
        if (data?.id) setLeads(prev => prev.filter(l => l.id !== data.id))
      },
      '__reconnected': () => fetchLeads(false),
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

  // Puxar pra atualizar (pull-to-refresh) no celular chama isso — sem
  // showLoading pra nao esconder a lista inteira atras de um spinner de tela
  // cheia, so o indicador de puxar mesmo.
  const refetch = useCallback(() => fetchLeads(false), [organizationId, currentOrganization?.id])

  return (
    <LeadsContext.Provider value={{ leads, setLeads, loading, error, stageStats, moveLeadToStage, refetch }}>
      {children}
    </LeadsContext.Provider>
  )
}

export function useLeadsContext() {
  const context = useContext(LeadsContext)
  if (context === undefined) throw new Error('useLeadsContext must be used within a LeadsProvider')
  return context
}
