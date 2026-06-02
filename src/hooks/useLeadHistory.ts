'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface HistoryEvent {
    id: string
    type: 'conversation' | 'automation' | 'stage_move' | 'value_change' | 'lead_created'
    timestamp: string
    actorName: string | null
    actorAvatar: string | null
    description: string
    secondaryLabel?: string
    meta?: Record<string, any>
}

export function useLeadHistory(organizationId: string, leadId: string) {
    const [events, setEvents] = useState<HistoryEvent[]>([])
    const [loading, setLoading] = useState(true)

    const fetchHistory = useCallback(async () => {
        if (!organizationId || !leadId) {
            setEvents([])
            setLoading(false)
            return
        }

        try {
            setLoading(true)

            // Fetch activities and stage history in parallel
            const [activitiesRes, stageHistoryRes, leadRes] = await Promise.all([
                supabase
                    .from('lead_activities')
                    .select(`
            id, type, content, metadata, created_at,
            actor:organization_members!fk_activities_actor(
              profiles(full_name, avatar_url)
            )
          `)
                    .eq('organization_id', organizationId)
                    .eq('lead_id', leadId)
                    .order('created_at', { ascending: false }),

                supabase
                    .from('lead_stage_history')
                    .select(`
            id, from_stage_id, to_stage_id, changed_at,
            changed_by:organization_members!fk_history_actor(
              profiles(full_name, avatar_url)
            ),
            from_stage:pipeline_stages!fk_history_from_stage(name),
            to_stage:pipeline_stages!fk_history_to_stage(name)
          `)
                    .eq('lead_id', leadId)
                    .order('changed_at', { ascending: false }),

                supabase
                    .from('leads')
                    .select('created_at, title, value')
                    .eq('id', leadId)
                    .single()
            ])

            const unified: HistoryEvent[] = []

            // Process activities
            if (activitiesRes.data) {
                for (const a of activitiesRes.data as any[]) {
                    const actorProfile = a.actor?.profiles
                    const metadata = a.metadata || {}
                    const direction = metadata.direction
                    const source = metadata.source

                    let type: HistoryEvent['type'] = 'conversation'
                    let description = ''
                    let secondaryLabel: string | undefined

                    // "Ajuste o histórico para que ele contenha apenas edições em: Nome do lead, campos customizados, notificações geradas e mudanças de pipeline"
                    let shouldInclude = false;

                    if (a.type === 'system' || a.type === 'system_note') {
                        if (metadata.source === 'custom_field' || metadata.source === 'rename' || a.type === 'system_note') {
                            type = 'value_change'
                            description = a.content || 'Atualização de campo'
                            secondaryLabel = 'Edição'
                            shouldInclude = true;
                        } else {
                            type = 'automation'
                            description = a.content || 'Notificação do Sistema'
                            secondaryLabel = 'Automação'
                            shouldInclude = true;
                        }
                    } else if (a.type === 'whatsapp' || a.type === 'email') {
                        // Only include "Notificações geradas" (Automations)
                        if (source === 'automation' || source === 'system') {
                            type = 'automation'
                            const senderName = metadata.sender_name || 'Sistema'
                            description = `Notificação gerada via ${senderName}`
                            if (a.content) {
                                const short = a.content.length > 60 ? a.content.slice(0, 60) + '…' : a.content
                                description += ` — "${short}"`
                            }
                            secondaryLabel = 'Automação'
                            shouldInclude = true;
                        }
                    } else if (a.type === 'value_change' || a.type === 'lead_update') {
                        type = 'value_change'
                        description = a.content || 'Atualização de campo'
                        secondaryLabel = 'Edição'
                        shouldInclude = true;
                    }

                    if (shouldInclude) {
                        unified.push({
                            id: a.id,
                            type,
                            timestamp: a.created_at,
                            actorName: actorProfile?.full_name || null,
                            actorAvatar: actorProfile?.avatar_url || null,
                            description,
                            secondaryLabel,
                            meta: metadata,
                        })
                    }
                }
            }

            // Process stage history
            if (stageHistoryRes.data) {
                for (const h of stageHistoryRes.data as any[]) {
                    const actorProfile = h.changed_by?.profiles
                    const fromName = h.from_stage?.name || 'Desconhecido'
                    const toName = h.to_stage?.name || 'Desconhecido'

                    let description: string
                    if (!h.from_stage_id) {
                        description = `Lead adicionado ao estágio ${toName}`
                    } else {
                        description = `Negócio movido ${fromName} para ${toName}`
                    }

                    unified.push({
                        id: h.id,
                        type: 'stage_move',
                        timestamp: h.changed_at,
                        actorName: actorProfile?.full_name || null,
                        actorAvatar: actorProfile?.avatar_url || null,
                        description,
                        secondaryLabel: 'Mudança de Etapa',
                    })
                }
            }

            // Add "Lead created" event from the lead itself
            if (leadRes.data) {
                const lead = leadRes.data as any
                unified.push({
                    id: `lead-created-${leadId}`,
                    type: 'lead_created',
                    timestamp: lead.created_at,
                    actorName: null,
                    actorAvatar: null,
                    description: 'Lead criado',
                    secondaryLabel: lead.value ? `R$ ${Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : undefined,
                })
            }

            // Sort descending
            unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

            setEvents(unified)
        } catch (err) {
            console.error('Failed to fetch lead history:', err)
            setEvents([])
        } finally {
            setLoading(false)
        }
    }, [organizationId, leadId])

    useEffect(() => {
        fetchHistory()

        // Subscribe to realtime changes for this lead's activities
        const activitiesChannel = supabase
            .channel(`public:lead_history_activities:${leadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'lead_activities',
                    filter: `lead_id=eq.${leadId}`,
                },
                () => {
                    fetchHistory()
                }
            )
            .subscribe()

        // Subscribe to realtime changes for this lead's stage history
        const stageChannel = supabase
            .channel(`public:lead_history_stages:${leadId}`)
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
            supabase.removeChannel(activitiesChannel)
            supabase.removeChannel(stageChannel)
        }
    }, [fetchHistory, leadId])

    return { events, loading, refresh: fetchHistory }
}
