'use client'

import React, { useEffect, useState } from 'react'
import { Notification } from '@/contexts/NotificationContext'
import {
    X,
    CheckCircle,
    WarningCircle,
    Info,
    XCircle,
    Headset
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

interface ToastProps {
    notification: Notification
    onClose: (id: string) => void
}

export default function Toast({ notification, onClose }: ToastProps) {
    const { id, type, title, message, actionText, onAction, linkUrl, duration = 5000 } = notification
    const [progress, setProgress] = useState(100)
    const [isClosing, setIsClosing] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const router = useRouter()

    useEffect(() => {
        // Trigger entrance animation
        const entranceTimer = requestAnimationFrame(() => {
            setIsVisible(true)
        })

        // Small delay to ensure the DOM paints the 100% width before we transition to 0
        const animationTimer = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setProgress(0)
            })
        })

        // Auto-close timer
        const timer = setTimeout(() => {
            handleClose()
        }, duration)

        return () => {
            cancelAnimationFrame(entranceTimer)
            cancelAnimationFrame(animationTimer)
            clearTimeout(timer)
        }
    }, [duration])

    const handleClose = () => {
        setIsClosing(true)
        setTimeout(() => onClose(id), 300) // matches the fade-out duration
    }

    const getIcon = () => {
        if (notification.customIcon) {
            const CustomIcon = notification.customIcon
            return <CustomIcon size={20} weight="fill" className="text-white" />
        }
        switch (type) {
            case 'success': return <CheckCircle size={20} weight="fill" className="text-white" />
            case 'warning': return <WarningCircle size={20} weight="fill" className="text-white" />
            case 'error': return <XCircle size={20} weight="fill" className="text-white" />
            case 'message': return <Headset size={20} weight="fill" className="text-white" />
            case 'info':
            default:
                return <Info size={20} weight="fill" className="text-white" />
        }
    }

    const getIconBackground = () => {
        switch (type) {
            case 'success': return 'bg-[#00B8D9]' // Cyan from reference
            case 'warning': return 'bg-orange-500'
            case 'error': return 'bg-red-500'
            case 'message': return 'bg-purple-500' // Distinctive color for support
            case 'info':
            default:
                return 'bg-[#00B8D9]'
        }
    }

    const getProgressColor = () => {
        switch (type) {
            case 'success': return 'bg-[#00B8D9]'
            case 'warning': return 'bg-orange-500'
            case 'error': return 'bg-red-500'
            case 'message': return 'bg-purple-500'
            case 'info':
            default:
                return 'bg-[#00B8D9]'
        }
    }

    return (
        <div
            className={`
                relative w-[340px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] 
                border border-gray-100 overflow-hidden p-4
                transition-all duration-300 ease-out
                ${isClosing || !isVisible ? 'opacity-0 -translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'}
            `}
        >
            <div className="flex items-start gap-3 relative z-10">
                {/* Icon Box */}
                <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${!notification.customColor ? getIconBackground() : ''} shadow-sm mt-0.5`}
                    style={notification.customColor ? { backgroundColor: notification.customColor } : undefined}
                >
                    {getIcon()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-[#00B8D9] tracking-wider uppercase">
                            ATLAS EYE
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-gray-400">Agora</span>
                            <button
                                onClick={handleClose}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>
                    </div>

                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-1">
                        {title}
                    </h3>

                    <p className="text-[13px] font-medium text-gray-500 leading-snug mb-3">
                        {message}
                    </p>

                    <div className="flex items-center gap-3">
                        {actionText && (onAction || linkUrl) && (
                            <button
                                onClick={() => {
                                    if (onAction) onAction()
                                    else if (linkUrl) router.push(linkUrl)
                                    handleClose()
                                }}
                                className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
                            >
                                {actionText}
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Ignorar
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress bar at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                <div
                    className={`h-full ${!notification.customColor ? getProgressColor() : ''} origin-left ease-linear`}
                    style={{
                        width: `${progress}%`,
                        transitionProperty: 'width',
                        transitionDuration: progress === 100 ? '0ms' : `${duration}ms`,
                        ...(notification.customColor ? { backgroundColor: notification.customColor } : {})
                    }}
                />
            </div>
        </div>
    )
}
