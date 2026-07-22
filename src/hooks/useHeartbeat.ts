'use client'

/**
 * useHeartbeat — avisa o backend que este membro está com o app aberto/em foco agora.
 * Usado pra decidir distribuição automática de leads (assignLeadOwner em
 * leadAutomations.ts): "online" = heartbeat nos últimos 2 minutos (ver ONLINE_WINDOW_MS lá).
 */
import { useEffect } from 'react'

const HEARTBEAT_INTERVAL_MS = 45_000

function sendHeartbeat() {
  fetch('/api/members/heartbeat', { method: 'POST' }).catch(() => {})
}

export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    sendHeartbeat()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])
}
