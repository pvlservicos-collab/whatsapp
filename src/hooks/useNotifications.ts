'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Notification } from '@/lib/types'
import { useAuth } from './useAuth'

export function useNotifications(limit: number = 20) {
    const { organizationId, currentOrganization } = useAuth()
    const memberId = currentOrganization?.id

    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = useCallback(async () => {
        if (!organizationId || !memberId) return

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('recipient_member_id', memberId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (!error && data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: any) => !n.is_read).length)
        }
        setLoading(false)
    }, [organizationId, memberId, limit])

    // Mark a single notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)

        if (!error) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }
    }, [])

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        if (!organizationId || !memberId) return

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('organization_id', organizationId)
            .eq('recipient_member_id', memberId)
            .eq('is_read', false)

        if (!error) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
            setUnreadCount(0)
        }
    }, [organizationId, memberId])

    // Initial fetch
    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    // Realtime subscription
    useEffect(() => {
        if (!organizationId || !memberId) return

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_member_id=eq.${memberId}`,
                },
                (payload) => {
                    const newNotif = payload.new as Notification
                    setNotifications((prev) => [newNotif, ...prev].slice(0, limit))
                    setUnreadCount((prev) => prev + 1)
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_member_id=eq.${memberId}`,
                },
                (payload) => {
                    const updated = payload.new as Notification
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
                    )
                    // Recalculate unread
                    setNotifications((prev) => {
                        setUnreadCount(prev.filter((n) => !n.is_read).length)
                        return prev
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [organizationId, memberId])

    return {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
    }
}
