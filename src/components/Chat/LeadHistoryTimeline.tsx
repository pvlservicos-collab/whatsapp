'use client'

import { useState } from 'react'
import { Plus, CaretDown, CaretUp } from '@phosphor-icons/react'
import { useLeadHistory, HistoryEvent } from '@/hooks/useLeadHistory'

interface LeadHistoryTimelineProps {
    organizationId: string
    leadId: string
}

/** Dot color per event type */
function dotColor(type: HistoryEvent['type']): string {
    switch (type) {
        case 'conversation': return '#8B5CF6'  // purple
        case 'automation': return '#F59E0B'  // amber
        case 'stage_move': return '#10B981'  // green
        case 'value_change': return '#3B82F6'  // blue
        case 'lead_created': return '#6B7280'  // gray
        default: return '#9CA3AF'
    }
}

/** Icon badge color per secondary label */
function badgeStyle(label: string | undefined): { bg: string; fg: string } {
    if (!label) return { bg: '#F3F4F6', fg: '#6B7280' }
    const lower = label.toLowerCase()
    if (lower === 'automação') return { bg: '#FEF3C7', fg: '#D97706' }
    if (lower === 'atendente') return { bg: '#DBEAFE', fg: '#2563EB' }
    if (lower === 'nota') return { bg: '#E0E7FF', fg: '#4F46E5' }
    return { bg: '#ECFDF5', fg: '#059669' }  // default green
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${mins}`
}

const INITIAL_SHOW = 5

export default function LeadHistoryTimeline({ organizationId, leadId }: LeadHistoryTimelineProps) {
    const { events, loading } = useLeadHistory(organizationId, leadId)
    const [expanded, setExpanded] = useState(false)

    if (loading) {
        return (
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Histórico
                </p>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-start gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-200 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 space-y-1">
                                <div className="h-3 bg-gray-200 rounded w-4/5" />
                                <div className="h-2.5 bg-gray-100 rounded w-3/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (events.length === 0) {
        return (
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Histórico
                </p>
                <p className="text-xs text-gray-400">Nenhum evento registrado.</p>
            </div>
        )
    }

    const displayEvents = expanded ? events : events.slice(0, INITIAL_SHOW)
    const hasMore = events.length > INITIAL_SHOW

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Histórico
                </p>
                <button
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    title="Adicionar evento"
                >
                    <Plus size={11} weight="bold" />
                    Adicionar
                </button>
            </div>

            <style>{`
        @keyframes historyFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .history-event-enter {
          animation: historyFadeIn 0.3s ease forwards;
        }
      `}</style>

            {/* Timeline */}
            <div className="relative">
                {displayEvents.map((event, idx) => {
                    const isLast = idx === displayEvents.length - 1
                    const color = dotColor(event.type)
                    const badge = badgeStyle(event.secondaryLabel)

                    return (
                        <div
                            key={event.id}
                            className="flex items-start gap-2.5 relative history-event-enter"
                            style={{ animationDelay: `${idx * 50}ms`, minHeight: 48 }}
                        >
                            {/* Dot + vertical line */}
                            <div className="relative flex-shrink-0 flex items-start justify-center" style={{ width: 14 }}>
                                {/* Vertical line */}
                                {!isLast && (
                                    <div
                                        className="absolute"
                                        style={{
                                            left: '50%',
                                            top: 12,
                                            transform: 'translateX(-50%)',
                                            width: 1.5,
                                            bottom: -4,
                                            background: `linear-gradient(to bottom, ${color}40, ${color}15)`,
                                        }}
                                    />
                                )}

                                {/* Dot */}
                                <div
                                    className="rounded-full flex-shrink-0 mt-[5px] relative z-10"
                                    style={{
                                        width: event.type === 'lead_created' ? 10 : 8,
                                        height: event.type === 'lead_created' ? 10 : 8,
                                        backgroundColor: color,
                                        boxShadow: `0 0 0 2px ${color}25`,
                                    }}
                                />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pb-3">
                                {/* Description */}
                                <p className="text-[11.5px] leading-snug text-gray-700 break-words">
                                    {event.description}
                                </p>

                                {/* Actor + secondary label */}
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {event.secondaryLabel && (
                                        <span
                                            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full"
                                            style={{ backgroundColor: badge.bg, color: badge.fg }}
                                        >
                                            {event.secondaryLabel}
                                        </span>
                                    )}

                                    {event.actorName && event.type !== 'conversation' && (
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                            {event.actorAvatar ? (
                                                <img src={event.actorAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                            ) : null}
                                            {event.actorName}
                                        </span>
                                    )}
                                </div>

                                {/* Timestamp */}
                                <p className="text-[10px] text-gray-300 mt-0.5">
                                    {formatDate(event.timestamp)}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Show more / less */}
            {hasMore && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1 ml-5"
                >
                    {expanded ? (
                        <>
                            <CaretUp size={10} weight="bold" />
                            Mostrar menos
                        </>
                    ) : (
                        <>
                            <CaretDown size={10} weight="bold" />
                            Ver todos ({events.length})
                        </>
                    )}
                </button>
            )}
        </div>
    )
}
