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

// Distância de arrasto (px) pra soltar e considerar "arquivar" — abaixo disso volta
// pro lugar. O ícone de arquivar por trás do card só aparece proporcionalmente ao
// quanto já foi arrastado (nunca em opacidade total antes do usuário puxar de verdade).
const ARCHIVE_TRIGGER_THRESHOLD = 80

const PAYMENT_METHOD_TAGS: Record<string, { label: string; style: React.CSSProperties }> = {
    pix: { label: 'PIX', style: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' } },
    credit_card: { label: 'Cartão', style: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' } },
    boleto: { label: 'Boleto', style: { backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c' } },
    dinheiro: { label: 'Dinheiro', style: { backgroundColor: 'rgba(52,211,153,0.15)', color: '#34d399' } },
}

const PAYMENT_STATUS_TAGS: Record<string, { label: string; style: React.CSSProperties }> = Object.fromEntries(
    Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => [value, { label: meta.label, style: TONE_STYLES[meta.tone] }])
)

const LeadListItem = ({ lead, isSelected, onClick, onContextMenu, onArchive, timeStr, hit, query, hideReplyHighlight }: LeadListItemProps) => {
    const defaultMsg = lead.last_activity_type ? 'Ver conversa' : 'Sem mensagens'
    const lastMsg = lead.last_message_content || defaultMsg

    // Swipe-to-archive (padrão WhatsApp) — só ativo quando o pai passa onArchive.
    const [dragX, setDragX] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)
    const isHorizontalSwipe = useRef<boolean | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!onArchive) return
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        isHorizontalSwipe.current = null
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!onArchive) return
        const dx = e.touches[0].clientX - touchStartX.current
        const dy = e.touches[0].clientY - touchStartY.current

        // Só decide uma vez, no primeiro movimento perceptível — sem isso um scroll
        // vertical da lista com um pixel de deriva horizontal já disparava o "modo
        // arrastar" e travava o scroll da lista inteira.
        if (isHorizontalSwipe.current === null) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy)
        }
        if (!isHorizontalSwipe.current) return

        e.preventDefault()
        setIsDragging(true)
        // Só arrasta pra esquerda (arquivar) — puxar pra direita não faz nada, nem
        // no WhatsApp real.
        setDragX(Math.min(0, dx))
    }

    const handleTouchEnd = () => {
        if (!onArchive) return
        if (Math.abs(dragX) >= ARCHIVE_TRIGGER_THRESHOLD) {
            onArchive(lead)
        }
        setDragX(0)
        setIsDragging(false)
        isHorizontalSwipe.current = null
    }

    const visibleTags = (lead.lead_tags || []).slice(0, 2)
    const extraTagsCount = (lead.lead_tags?.length || 0) - visibleTags.length

    const orderPaymentMethod = lead.custom_attributes?.last_order_payment_method as string | undefined
    const orderPaymentStatus = lead.custom_attributes?.last_order_payment_status as string | undefined

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

    const archiveRevealOpacity = Math.min(1, Math.abs(dragX) / ARCHIVE_TRIGGER_THRESHOLD)

    return (
        <div className="w-full flex-shrink-0 relative overflow-hidden">
            {onArchive && (
                <div
                    className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500"
                    style={{ opacity: archiveRevealOpacity }}
                >
                    <Archive size={20} weight="bold" className="text-white" />
                </div>
            )}
            <button
                onClick={() => onClick(lead)}
                onContextMenu={(e) => onContextMenu(e, lead)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`relative w-full text-left px-4 py-3 border-b border-[var(--chat-bg-hover)] ${isDragging ? '' : 'transition-transform'} ${isSelected
                    ? 'bg-[var(--chat-bg-hover)] border-l-[3px] border-l-[var(--chat-accent)]'
                    : lead.last_message_sender_type === 'lead'
                        ? 'hover:bg-[var(--chat-bg-panel)] border-l-[3px]'
                        : 'hover:bg-[var(--chat-bg-panel)] border-l-[3px] border-l-transparent'
                    }`}
                style={{
                    ...(unreadGradient ? { background: unreadGradient } : {}),
                    ...(!isSelected && lead.last_message_sender_type === 'lead' ? { borderLeftColor: '#f59e0b' } : {}),
                    transform: `translateX(${dragX}px)`,
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

                        {/* Order status tags + lead tags — badges de grupo/canal já saíram daqui, ficam do lado do nome.
                            Opacidade reduzida e no máx. 2 tags (+N pro resto) — a lista inteira de tags
                            brigando por atenção deixava a linha poluída/difícil de escanear rápido. */}
                        {(orderPaymentMethod || visibleTags.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1.5 items-center opacity-80">
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
                                {visibleTags.map((lt: any) => {
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
                                {extraTagsCount > 0 && (
                                    <span className="text-[9px] font-bold text-[var(--chat-text-tertiary)] px-1">+{extraTagsCount}</span>
                                )}
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
