'use client'

import { useState } from 'react'
import { useLeadActivities, useAuth, useChatButtonSettings } from '@/hooks'
import { LeadWithOwner, LeadActivityWithActor } from '@/lib/types'
import ActivityTimeline from './ActivityTimeline'
import ActivityComposer from './ActivityComposer'

import { ChatButtonKey } from '@/hooks/useChatButtonSettings'

interface ChatWindowProps {
  lead: LeadWithOwner
  organizationId: string
  onMessageSent?: (content: string) => void
}

export interface ReplyContext {
  messageId: string
  text: string
  sender: string
}

export default function ChatWindow({ lead, organizationId, onMessageSent }: ChatWindowProps) {
  const { activities, loading, sendHumanMessage } = useLeadActivities(organizationId, lead.id)
  const { currentOrganization } = useAuth()
  const { settings: chatButtonSettings, fireWebhook } = useChatButtonSettings()
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const handleSendActivity = async (content: string) => {
    if (!content.trim()) return
    setSendError(null)

    if (!currentOrganization) {
      setSendError('Sessão não identificada. Recarregue a página e tente novamente.')
      return
    }

    try {
      if (onMessageSent) onMessageSent(content)

      const replyMessageId = replyContext?.messageId
      const replyPreview = replyContext ? { text: replyContext.text, sender: replyContext.sender } : undefined

      // Clear reply before sending so UI updates immediately
      setReplyContext(null)

      await sendHumanMessage(content, 'whatsapp', currentOrganization.id, replyMessageId, replyPreview)
    } catch (error) {
      console.error('Failed to send activity:', error)
      setSendError('Falha ao enviar mensagem. Verifique sua conexão e tente novamente.')
    }
  }

  const handleReply = (activity: LeadActivityWithActor) => {
    const messageId = activity.metadata?.message_id || activity.id
    const text = activity.content || ''
    const sender = activity.metadata?.sender_name || activity.actor?.profiles?.full_name || lead.title || 'Lead'

    setReplyContext({ messageId, text, sender })
  }

  return (
    <div
      className="flex flex-col h-full relative overflow-x-hidden"
      style={{
        backgroundColor: '#F6F9FF',
        backgroundImage: `url('/chat-bg.svg')`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto',
      }}
    >
      {/* Timeline */}
      <ActivityTimeline
        activities={activities}
        loading={loading}
        lead={lead}
        onReply={handleReply}
      />

      {/* Send Error Banner */}
      {sendError && (
        <div className="mx-4 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-red-700">{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            className="text-red-400 hover:text-red-600 text-xs font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Composer Bottom */}
      <ActivityComposer
        onSend={handleSendActivity}
        replyContext={replyContext}
        onCancelReply={() => setReplyContext(null)}
        chatButtonSettings={chatButtonSettings}
        fireWebhook={async (key: ChatButtonKey) => {
          return fireWebhook(key, {
            id: lead.id,
            title: lead.title,
            phone: lead.phone,
            email: lead.email,
            stageName: lead.stage?.name,
          })
        }}
      />
    </div>
  )
}
