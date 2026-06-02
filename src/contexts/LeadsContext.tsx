'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { LeadWithOwner } from '@/lib/types'
import { useAuth } from '@/hooks'

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
    const { currentOrganization, user, permissions } = useAuth()
    const [leads, setLeads] = useState<LeadWithOwner[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stageStats, setStageStats] = useState<Record<string, StageStats>>({})

    const organizationId = currentOrganization?.organization_id

    useEffect(() => {
        if (!organizationId) {
            setLoading(false)
            return
        }

        const viewOwnOnly = permissions?.leads?.view_own_only
        const memberId = currentOrganization?.id

        async function fetchLeads() {
            try {
                setLoading(true)
                setError(null)

                let query = supabase
                    .from('leads')
                    .select(`
                        *,
                        lead_tags(tag_id, tag:tags(id, name, color)),
                        integration:integrations(id, name, type),
                        stage:pipeline_stages(id, pipeline_id, name),
                        owner:organization_members!fk_leads_owner(id, profiles(full_name, avatar_url))
                    `)
                    .eq('organization_id', organizationId)
                    .is('deleted_at', null)

                if (viewOwnOnly && memberId) {
                    query = query.eq('owner_member_id', memberId)
                }

                const { data, error: err } = await query
                    .order('last_activity_at', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })

                if (err) {
                    console.warn('[LeadsProvider] JOIN query failed, falling back:', err.message)
                    let fallbackQuery = supabase
                        .from('leads')
                        .select('*')
                        .eq('organization_id', organizationId)
                        .is('deleted_at', null)

                    if (viewOwnOnly && memberId) {
                        fallbackQuery = fallbackQuery.eq('owner_member_id', memberId)
                    }

                    const { data: fallbackData, error: fallbackErr } = await fallbackQuery
                        .order('last_activity_at', { ascending: false, nullsFirst: false })
                        .order('created_at', { ascending: false })

                    if (fallbackErr) throw fallbackErr
                    setLeads(fallbackData || [])
                    return
                }

                setLeads(data || [])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch leads')
            } finally {
                setLoading(false)
            }
        }

        fetchLeads()

        // Fetch real stage counts (lightweight query — just stage_id + value)
        async function fetchStageStats() {
            try {
                const { data } = await supabase
                    .from('leads')
                    .select('stage_id, value')
                    .eq('organization_id', organizationId)
                    .is('deleted_at', null)
                    .or('is_group.is.null,is_group.eq.false')

                if (data) {
                    const stats: Record<string, StageStats> = {}
                    for (const lead of data) {
                        if (!lead.stage_id) continue
                        if (!stats[lead.stage_id]) stats[lead.stage_id] = { count: 0, totalValue: 0 }
                        stats[lead.stage_id].count++
                        stats[lead.stage_id].totalValue += lead.value || 0
                    }
                    setStageStats(stats)
                }
            } catch (err) {
                console.warn('[LeadsProvider] fetchStageStats error:', err)
            }
        }
        fetchStageStats()

        // Global Realtime Subscription
        const channel = supabase
            .channel(`leads_global:${organizationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leads',
                    filter: `organization_id=eq.${organizationId}${viewOwnOnly && memberId ? `&owner_member_id=eq.${memberId}` : ''}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setLeads((prev) => [payload.new as LeadWithOwner, ...prev])

                        setTimeout(async () => {
                            const { data } = await supabase
                                .from('leads')
                                .select(`*, lead_tags(tag_id, tag:tags(id, name, color)), integration:integrations(id, name, type), stage:pipeline_stages(id, pipeline_id, name), owner:organization_members!fk_leads_owner(id, profiles(full_name, avatar_url))`)
                                .eq('id', payload.new.id)
                                .single();

                            if (data) {
                                setLeads((prev) => prev.map(l => l.id === payload.new.id ? { ...l, ...data as LeadWithOwner } : l))
                            }
                        }, 1000)
                    } else if (payload.eventType === 'UPDATE') {
                        setLeads((prev) =>
                            prev.map((l) =>
                                l.id === payload.new.id
                                    ? { ...l, ...payload.new }
                                    : l
                            )
                        )
                    } else if (payload.eventType === 'DELETE') {
                        setLeads((prev) => prev.filter((l) => l.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [organizationId, user, currentOrganization, permissions])

    const moveLeadToStage = useCallback(
        async (leadId: string, newStageId: string, oldStageId?: string, memberId?: string) => {
            setLeads((prev) =>
                prev.map((l) =>
                    l.id === leadId ? { ...l, stage_id: newStageId } : l
                )
            )

            try {
                const timestamp = new Date().toISOString()
                const { error } = await supabase
                    .from('leads')
                    .update({ stage_id: newStageId, updated_at: timestamp })
                    .eq('id', leadId)

                if (error) throw error
            } catch (err) {
                console.error('Failed to update lead stage:', err)
                if (oldStageId) {
                    setLeads((prev) =>
                        prev.map((l) =>
                            l.id === leadId ? { ...l, stage_id: oldStageId } : l
                        )
                    )
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
    if (context === undefined) {
        throw new Error('useLeadsContext must be used within a LeadsProvider')
    }
    return context
}
