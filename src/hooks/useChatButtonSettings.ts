'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAuth } from './useAuth'

export interface ChatButtonConfig {
  enabled: boolean
  webhook_url: string
  position: 'chat' | 'sidebar'
}

export interface ChatButtonSettings {
  pausar_ia: ChatButtonConfig
  sugerir_passos: ChatButtonConfig
  sinalizar_ajuste: ChatButtonConfig
  resumir_conversa: ChatButtonConfig
}

export type ChatButtonKey = keyof ChatButtonSettings

const DEFAULT_SETTINGS: ChatButtonSettings = {
  pausar_ia: { enabled: true, webhook_url: '', position: 'chat' },
  sugerir_passos: { enabled: true, webhook_url: '', position: 'chat' },
  sinalizar_ajuste: { enabled: false, webhook_url: '', position: 'chat' },
  resumir_conversa: { enabled: false, webhook_url: '', position: 'chat' },
}

const SETTINGS_KEY = 'chat_button_toggles'

export function useChatButtonSettings() {
  const { organizationId } = useAuth()
  const [settings, setSettings] = useState<ChatButtonSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!organizationId) return
    try {
      const { data } = await supabase
        .from('automation_settings')
        .select('variables')
        .eq('organization_id', organizationId)
        .eq('key', SETTINGS_KEY)
        .single()

      if (data?.variables) {
        const raw = data.variables as any
        const parsed: any = {}
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          const rawVal = raw[key]
          if (typeof rawVal === 'boolean') {
            parsed[key] = { enabled: rawVal, webhook_url: '', position: 'chat' }
          } else if (rawVal && typeof rawVal === 'object') {
            parsed[key] = {
              enabled: !!rawVal.enabled,
              webhook_url: rawVal.webhook_url || '',
              position: rawVal.position === 'sidebar' ? 'sidebar' : 'chat'
            }
          } else {
            parsed[key] = DEFAULT_SETTINGS[key as ChatButtonKey]
          }
        }
        setSettings(parsed as ChatButtonSettings)
      }
    } catch {
      // No settings found, use defaults
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates: Partial<ChatButtonSettings>) => {
    if (!organizationId) return
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings) // Optimistic update

    const { error } = await supabase
      .from('automation_settings')
      .upsert({
        organization_id: organizationId,
        key: SETTINGS_KEY,
        is_enabled: true,
        variables: newSettings,
      }, {
        onConflict: 'organization_id,key'
      })

    if (error) {
      console.error('Failed to save chat button settings:', error)
      setSettings(settings) // Revert
    }
  }

  const fireWebhook = useCallback(
    async (
      key: ChatButtonKey,
      leadData: {
        id: string
        title: string
        phone?: string
        email?: string
        stageName?: string
      }
    ) => {
      const config = settings[key]
      if (!config.enabled || !config.webhook_url) {
        console.warn(`[useChatButtons] Button "${key}" not enabled or no webhook URL`)
        return false
      }

      try {
        const payload = {
          action: key,
          context: {
            organization_id: organizationId,
            timestamp: new Date().toISOString()
          },
          lead: {
            id: leadData.id,
            title: leadData.title,
            phone: leadData.phone || null,
            email: leadData.email || null,
            stage: leadData.stageName || null
          }
        }

        const response = await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        console.log(`[useChatButtons] Webhook fired for "${key}":`, response.status)
        return response.ok
      } catch (err) {
        console.error(`[useChatButtons] Webhook error for "${key}":`, err)
        return false
      }
    },
    [settings, organizationId]
  )

  return { settings, loading, updateSettings, fireWebhook }
}
