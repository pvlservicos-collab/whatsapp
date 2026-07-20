'use client'

import { memo, useRef, useState } from 'react'
import { LeadWithOwner, SearchHit } from '@/lib/types'
import { Robot, PushPin, Archive } from '@phosphor-icons/react'
import { getInitials, formatPhone, renderSnippet } from '@/lib/utils'
import IntegrationBadge from '@/components/Shared/IntegrationBadge'
import LeadBadges from '@/components/Shared/LeadBadges'
import { PAYMENT_STATUS_META, TONE_STYLES } from '@/lib/orderStatus'

interface LeadListItemProps {
    lead: LeadWithOwner
    isSelected: boolean
    onClick: (lead: LeadWithOwner) => void
    onContextMenu: (e: React.MouseEvent, lead: LeadWithOwner) => void
    onArchive?: (lead: LeadWithOwner) => void
    timeStr: string
    hit?: SearchHit
    query?: string
    hideReplyHighlight?: boolean
}

const PAYMENT_METHOD_TAGS: Record<string, { label: string; style: React.CSSProperties }> = {
    pix: { label: 'PIX', style: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' } },
    credit_card: { label: 'Cartão', style: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' } },
    boleto: { label: 'Boleto', style: { backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c' } },
    dinheiro: { label: 'Dinheiro', style: { backgroundColor: 'rgba(52,211,153,0.15)', color: '#34d399' } },
}

const PAYMENT_STATUS_TAGS: Record<string, { label: string; style: React.CSSProperties }> = Object.fromEntries(
    Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => [value, { label: meta.label, style: TONE_STYLES[meta.tone] }])
)

// Arrastar pra arquivar (padrão WhatsApp) — só dispara com arraste predominantemente
// horizontal (senão atrapalharia o scroll vertical normal da lista) e só pra esquerda.
const ARCHIVE_REVEAL_WIDTH = 76
const ARCHIVE_TRIGGER_THRESHOLD = 56

const LeadListItem = ({ lead, isSelected, onClick, onContextMenu, onArchive, timeStr, hit, query, hideReplyHighlight }: LeadListItemProps) => {
    const defaultMsg = lead.last_activity_type ? 'Ver conversa' : 'Sem mensagens'
    const lastMsg = lead.last_message_content || defaultMsg

    const orderPaymentMethod = lead.custom_attributes?.last_order_payment_method as string | undefined
    const orderPaymentStatus = lead.custom_attributes?.last_order_payment_status as string | undefined

    const [dragX, setDragX] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const touchStart = useRef<{ x: number; y: number } | null>(null)
    const axisLocked = useRef<'x' | 'y' | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!onArchive) return
        const t = e.touches[0]
        touchStart.current = { x: t.clientX, y: t.clientY }
        axisLocked.current = null
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!onArchive || !touchStart.current) return
        const t = e.touches[0]
        const deltaX = t.clientX - touchStart.current.x
        const deltaY = t.clientY - touchStart.current.y

        if (!axisLocked.current) {
            if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
            axisLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
        }
        if (axisLocked.current !== 'x') return

        e.preventDefault()
        setIsDragging(true)
        // Só arrasta pra esquerda (arquivar) — direita sempre volta pro lugar.
        setDragX(Math.max(-ARCHIVE_REVEAL_WIDTH - 24, Math.min(0, deltaX)))
    }

    const handleTouchEnd = () => {
        if (!onArchive) return
        setIsDragging(false)
        if (dragX <= -ARCHIVE_TRIGGER_THRESHOLD) {
            onArchive(lead)
        }
        setDragX(0)
        touchStart.current = null
        axisLocked.current = null
    }

    let SenderIcon = null
    let iconColor = ''

    if (lead.last_message_sender_type === 'ai' || lead.last_message_sender_type === 'ai_agent') {
        SenderIcon = Robot
        iconColor = 'text-violet-600'
    }

    const unreadGradient = lead.is_unread
        ? (lead.last_message_sender_type === 'lead'
            ? 'linear-gradient(to right, rgba(34,197,94,0.5), transparent 80%)'
            : 'linear-gradient(to right, rgba(59,130,246,0.5), transparent 80%)')
        : (lead.last_message_sender_type === 'human' && !hideReplyHighlight
            ? 'linear-gradient(to right, rgba(45,212,191,0.35), transparent 80%)'
            : undefined)

    return (
        <div className="w-full flex-shrink-0 relative overflow-hidden">
            {onArchive && (
                <div
                    className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white"
                    style={{ width: ARCHIVE_REVEAL_WIDTH }}
                    aria-hidden="true"
                >
                    <div className="flex flex-col items-center gap-0.5">
                        <Archive size={20} weight="bold" />
                        <span className="text-[10px] font-bold">{lead.is_archived ? 'Reabrir' : 'Arquivar'}</span>
                    </div>
                </div>
            )}
            <button
                onClick={() => { if (Math.abs(dragX) < 4) onClick(lead) }}
                onContextMenu={(e) => onContextMenu(e, lead)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`w-full text-left px-4 py-3 border-b border-[var(--chat-bg-hover)] relative bg-[var(--chat-bg-base)] ${isSelected
                    ? 'bg-[var(--chat-bg-hover)] border-l-[3px] border-l-[var(--chat-accent)]'
                    : 'hover:bg-[var(--chat-bg-panel)] border-l-[3px] border-l-transparent'
                    } ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
                style={{
                    ...(unreadGradient ? { background: unreadGradient } : undefined),
                    transform: `translateX(${dragX}px)`,
                    touchAction: onArchive ? 'pan-y' : undefined,
                }}
            >
                <div className="flex items-center gap-3 w-full">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        {lead.is_pinned && (
                            <div className="absolute -top-1 -left-1 z-10 bg-[var(--chat-bg-base)] rounded-full p-[1px]">
                                <PushPin size={12} weight="fill" className="text-[var(--chat-accent)] -rotate-45" />
                            </div>
                        )}
                        <div className="w-10 h-10 rounded-full bg-[var(--chat-bg-hover)] flex items-center justify-center overflow-hidden border border-[var(--chat-bg-hover)]">
                            {lead.avatar_url ? (
                                <img src={lead.avatar_url} alt={lead.title} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-[var(--chat-accent)]">{getInitials(lead.title)}</span>
                            )}
                        </div>
                        <IntegrationBadge lead={lead} size="sm" />
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between mb-[2px] w-full">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <LeadBadges lead={lead} size="sm" />
                                <h3 className={`text-[15px] leading-tight truncate ${lead.is_unread ? 'font-bold text-[var(--chat-text-primary)]' : 'font-medium text-[var(--chat-text-secondary)]'}`}>
                                    {formatPhone(lead.title)}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                                {lead.is_unread && (
                                    <div className="w-2 h-2 rounded-full bg-[var(--chat-accent)] flex-shrink-0" />
                                )}
                                <span className={`text-[11px] flex-shrink-0 ${lead.is_unread ? 'text-[var(--chat-accent)] font-bold' : 'text-[var(--chat-text-tertiary)] font-medium'}`}>
                                    {timeStr}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-hidden w-full">
                            {SenderIcon && <SenderIcon weight="fill" className={`flex-shrink-0 ${iconColor} w-3.5 h-3.5`} />}
                            <p className={`text-[13px] truncate ${lead.is_unread ? 'text-[var(--chat-text-secondary)] font-medium' : (lastMsg ? 'text-[var(--chat-text-muted)]' : 'text-[var(--chat-text-tertiary)] italic')}`}>
                                {lastMsg}
                            </p>
                        </div>

                        {hit?.matchType === 'message' && hit.snippet && (
                            <div className="text-xs text-[var(--chat-text-muted)] italic mt-0.5 line-clamp-1">
                                <span className="text-[var(--chat-accent)] mr-1">↩</span>
                                <span dangerouslySetInnerHTML={{ __html: renderSnippet(hit.snippet, query ?? '') }} />
                            </div>
                        )}

                        {/* Order status tags + lead tags — badges de grupo/canal já saíram daqui, ficam do lado do nome */}
                        {(orderPaymentMethod || (lead.lead_tags && lead.lead_tags.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                                {orderPaymentMethod && PAYMENT_METHOD_TAGS[orderPaymentMethod] && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style={PAYMENT_METHOD_TAGS[orderPaymentMethod].style}>
                                        {PAYMENT_METHOD_TAGS[orderPaymentMethod].label}
                                    </span>
                                )}
                                {orderPaymentStatus && PAYMENT_STATUS_TAGS[orderPaymentStatus] && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style={PAYMENT_STATUS_TAGS[orderPaymentStatus].style}>
                                        {PAYMENT_STATUS_TAGS[orderPaymentStatus].label}
                                    </span>
                                )}
                                {lead.lead_tags && lead.lead_tags.map((lt: any) => {
                                    const tag = lt.tag
                                    if (!tag) return null
                                    const isHex = tag.color?.startsWith('#')
                                    return (
                                        <span
                                            key={lt.tag_id}
                                            className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${!isHex ? tag.color : ''}`}
                                            style={isHex ? { backgroundColor: tag.color + '1A', color: tag.color } : {}}
                                        >
                                            {tag.name}
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </button>
        </div>
    )
}

export default memo(LeadListItem, (prevProps, nextProps) => {
    return (
        prevProps.lead.id === nextProps.lead.id &&
        prevProps.lead.updated_at === nextProps.lead.updated_at &&
        prevProps.lead.is_unread === nextProps.lead.is_unread &&
        prevProps.lead.is_archived === nextProps.lead.is_archived &&
        prevProps.lead.last_message_sender_type === nextProps.lead.last_message_sender_type &&
        prevProps.lead.integration_id === nextProps.lead.integration_id &&
        prevProps.lead.integration?.type === nextProps.lead.integration?.type &&
        prevProps.lead.is_group === nextProps.lead.is_group &&
        prevProps.lead.custom_attributes?.last_order_payment_status === nextProps.lead.custom_attributes?.last_order_payment_status &&
        prevProps.lead.custom_attributes?.last_order_payment_method === nextProps.lead.custom_attributes?.last_order_payment_method &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.hideReplyHighlight === nextProps.hideReplyHighlight &&
        prevProps.timeStr === nextProps.timeStr &&
        prevProps.query === nextProps.query &&
        prevProps.hit?.matchType === nextProps.hit?.matchType &&
        prevProps.hit?.snippet === nextProps.hit?.snippet
    )
})
