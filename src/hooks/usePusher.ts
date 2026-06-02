'use client'

/**
 * usePusher — hook de realtime para o cliente
 * Substitui supabase.channel().on('postgres_changes').subscribe()
 *
 * Uso:
 *   usePusherChannel(`lead-${leadId}`, {
 *     'activity.created': (data) => { ... },
 *     'lead.updated': () => refetch(),
 *   })
 */
import { useEffect, useRef } from 'react'
import PusherClient from 'pusher-js'

let _pusherClient: PusherClient | null = null

function getPusherClient(): PusherClient {
  if (typeof window === 'undefined') throw new Error('Pusher só pode ser usado no cliente')
  if (!_pusherClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster) {
      throw new Error('NEXT_PUBLIC_PUSHER_KEY e NEXT_PUBLIC_PUSHER_CLUSTER não definidos')
    }
    _pusherClient = new PusherClient(key, { cluster })
  }
  return _pusherClient
}

type EventHandlers = Record<string, (data?: any) => void>

export function usePusherChannel(channelName: string, handlers: EventHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!channelName || typeof window === 'undefined') return

    let pusher: PusherClient
    let channel: ReturnType<PusherClient['subscribe']>

    try {
      pusher = getPusherClient()
      channel = pusher.subscribe(channelName)

      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        channel.bind(event, handler)
      })
    } catch (err) {
      console.warn('[Pusher] Falha ao assinar canal:', channelName, err)
      return
    }

    return () => {
      try {
        Object.keys(handlersRef.current).forEach((event) => {
          channel.unbind(event)
        })
        pusher.unsubscribe(channelName)
      } catch {}
    }
  }, [channelName])
}
