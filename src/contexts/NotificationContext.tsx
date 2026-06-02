'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import ToastContainer from '@/components/Shared/Toast/ToastContainer'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks'

export type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'message'

export interface Notification {
    id: string
    type: NotificationType
    title: string
    message: string
    actionText?: string
    onAction?: () => void
    duration?: number // Default: 5000ms
    linkUrl?: string  // URL to navigate when clicked in history
    customColor?: string // Optional hex color for custom styling
    customIcon?: React.ElementType // Optional React Component for custom icon
    skipPersist?: boolean // If true, won't be saved to database history
}

interface NotificationContextProps {
    notifications: Notification[]
    addNotification: (notification: Omit<Notification, 'id'>) => void
    removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const { organizationId, currentOrganization } = useAuth()

    const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9)
        const isTest = notification.skipPersist === true

        const newNotification = {
            ...notification,
            id,
            duration: notification.duration || 5000,
            actionText: isTest ? notification.actionText : (notification.actionText || 'Ver chat'),
            linkUrl: isTest ? notification.linkUrl : (notification.linkUrl || '/chat')
        }

        // Show toast
        setNotifications((prev) => [...prev, newNotification])

        // Persist to database for notification history
        if (!notification.skipPersist) {
            const memberId = currentOrganization?.id
            if (organizationId && memberId) {
                supabase
                    .from('notifications')
                    .insert({
                        organization_id: organizationId,
                        recipient_member_id: memberId,
                        type: newNotification.type || 'info',
                        title: newNotification.title || null,
                        content: newNotification.message || null,
                        link_url: newNotification.linkUrl || null,
                        is_read: false,
                    })
                    .then(({ error }) => {
                        if (error) {
                            console.error('[NotificationContext] Failed to persist notification:', error.message)
                        }
                    })
            }
        }
    }, [organizationId, currentOrganization])

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, [])

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
            <ToastContainer notifications={notifications} removeNotification={removeNotification} />
        </NotificationContext.Provider>
    )
}

export function useNotification() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider')
    }
    return context
}
