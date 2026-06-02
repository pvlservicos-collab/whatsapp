'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Circle, CheckCircle, BellSlash } from '@phosphor-icons/react'
import { useNotifications } from '@/hooks/useNotifications'
import { Notification } from '@/lib/types'
import { useRouter } from 'next/navigation'

function formatRelativeTime(dateString: string): string {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return 'Agora mesmo'
    if (diffMin < 60) return `Há ${diffMin} min`
    if (diffHour < 24) return `Há ${diffHour} hora${diffHour > 1 ? 's' : ''}`
    if (diffDay < 7) return `Há ${diffDay} dia${diffDay > 1 ? 's' : ''}`

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function NotificationItem({
    notification,
    onClickNotification,
}: {
    notification: Notification
    onClickNotification: (n: Notification) => void
}) {
    return (
        <button
            onClick={() => onClickNotification(notification)}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50/40' : ''
                }`}
        >
            {/* Unread dot */}
            <div className="pt-1.5 shrink-0">
                {!notification.is_read ? (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                ) : (
                    <div className="w-2 h-2" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">
                    {notification.title && (
                        <span className="font-medium">{notification.title}</span>
                    )}
                    {notification.title && notification.content && ' '}
                    {notification.content && (
                        <span className="text-gray-600">{notification.content}</span>
                    )}
                    {!notification.title && !notification.content && (
                        <span className="text-gray-500 italic">Nova notificação</span>
                    )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {formatRelativeTime(notification.created_at)}
                </p>
            </div>
        </button>
    )
}

export default function NotificationDropdown() {
    const [open, setOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
    } = useNotifications()

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleClickNotification = (notification: Notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id)
        }
        if (notification.link_url) {
            router.push(notification.link_url)
            setOpen(false)
        }
    }

    const handleMarkAllAsRead = (e: React.MouseEvent) => {
        e.stopPropagation()
        markAllAsRead()
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-gray-100 rounded-xl shadow-lg shadow-gray-200/60 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Notificações</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors uppercase tracking-wide"
                            >
                                Marcar lidas
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[340px] overflow-y-auto overscroll-contain">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                                <BellSlash size={32} weight="light" />
                                <p className="text-sm">Nenhuma notificação</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onClickNotification={handleClickNotification}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="border-t border-gray-100 px-4 py-2.5">
                            <button
                                onClick={() => {
                                    setOpen(false)
                                    router.push('/notifications')
                                }}
                                className="w-full text-center text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
                            >
                                Ver todas as notificações
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
