'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import {
  PaperPlaneRight,
  Smiley,
  Paperclip,
  Pause,
  Sparkle,
  X,
  ArrowBendUpLeft,
  Flag,
  ChatText
} from '@phosphor-icons/react'
import { ReplyContext } from './ChatWindow'
import { ChatButtonSettings, ChatButtonKey } from '@/hooks/useChatButtonSettings'

interface ActivityComposerProps {
  onSend: (content: string) => Promise<void>
  replyContext?: ReplyContext | null
  onCancelReply?: () => void
  chatButtonSettings?: ChatButtonSettings
  fireWebhook?: (key: ChatButtonKey) => Promise<boolean>
}

export default function ActivityComposer({
  onSend,
  replyContext,
  onCancelReply,
  chatButtonSettings,
  fireWebhook,
}: ActivityComposerProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState<{
    key: ChatButtonKey
    status: 'sending' | 'success' | 'error'
  } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // Focus input when reply context changes
  useEffect(() => {
    if (replyContext) {
      inputRef.current?.focus()
    }
  }, [replyContext])

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    setContent((prev) => prev + emojiData.emoji)
    inputRef.current?.focus()
  }, [])

  // Auto-resize textarea to fit content, capped at max height
  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto' // reset to recalculate
    el.style.height = `${Math.min(el.scrollHeight, 160)}px` // max ~6 lines
  }, [])

  useEffect(() => {
    autoResize()
  }, [content, autoResize])

  const handleSend = async () => {
    if (!content.trim()) return

    const msgToSend = content
    setContent('') // Clear instantly for optimal user perception
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      setSending(true)
      await onSend(msgToSend)
    } catch (error) {
      console.error('Failed to send:', error)
      setContent(msgToSend) // Revert on error
    } finally {
      setSending(false)
    }
  }

  const handleChatButtonClick = async (key: ChatButtonKey) => {
    if (!fireWebhook) return
    setWebhookStatus({ key, status: 'sending' })
    const ok = await fireWebhook(key)
    setWebhookStatus({ key, status: ok ? 'success' : 'error' })
    setTimeout(() => setWebhookStatus(null), 2500)
  }

  const getButtonStateClass = (key: ChatButtonKey, baseClasses: string) => {
    const isThisButton = webhookStatus?.key === key
    const status = isThisButton ? webhookStatus?.status : null
    if (status === 'success') return 'bg-green-50 border-green-200 text-green-700'
    if (status === 'error') return 'bg-red-50 border-red-200 text-red-700'
    if (status === 'sending') return 'bg-gray-50 border-gray-200 text-gray-400 cursor-wait'
    return baseClasses
  }

  const getButtonStatusIcon = (key: ChatButtonKey) => {
    const isThisButton = webhookStatus?.key === key
    const status = isThisButton ? webhookStatus?.status : null
    if (status === 'sending') return <span className="animate-spin text-[10px] ml-1">⏳</span>
    if (status === 'success') return <span className="text-[10px] ml-1">✓</span>
    if (status === 'error') return <span className="text-[10px] ml-1">✗</span>
    return null
  }

  return (
    <div className="px-6 pb-4 pt-2 space-y-3 relative z-10 bg-gradient-to-t from-[#F6F9FF] to-transparent">
      {/* Action Buttons */}
      <div className="flex gap-2 items-center mb-1 flex-wrap">
        {chatButtonSettings?.pausar_ia?.enabled && (!chatButtonSettings.pausar_ia.position || chatButtonSettings.pausar_ia.position === 'chat') && (
          <button
            onClick={() => handleChatButtonClick('pausar_ia')}
            disabled={webhookStatus?.key === 'pausar_ia' && webhookStatus.status === 'sending'}
            className={`flex items-center gap-1.5 px-4 py-1.5 border rounded-full text-[11px] font-bold transition-colors ${getButtonStateClass('pausar_ia', 'text-purple-600 border-purple-100 bg-purple-50 hover:bg-purple-100')}`}
          >
            <Pause size={14} weight="bold" />
            Pausar IA
            {getButtonStatusIcon('pausar_ia')}
          </button>
        )}
        {chatButtonSettings?.sugerir_passos?.enabled && (!chatButtonSettings.sugerir_passos.position || chatButtonSettings.sugerir_passos.position === 'chat') && (
          <button
            onClick={() => handleChatButtonClick('sugerir_passos')}
            disabled={webhookStatus?.key === 'sugerir_passos' && webhookStatus.status === 'sending'}
            className={`flex items-center gap-1.5 px-4 py-1.5 border rounded-full text-[11px] font-bold transition-colors ${getButtonStateClass('sugerir_passos', 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50')}`}
          >
            <Sparkle size={14} weight="bold" />
            Sugerir próximos passos
            {getButtonStatusIcon('sugerir_passos')}
          </button>
        )}
        {chatButtonSettings?.sinalizar_ajuste?.enabled && (!chatButtonSettings.sinalizar_ajuste.position || chatButtonSettings.sinalizar_ajuste.position === 'chat') && (
          <button
            onClick={() => handleChatButtonClick('sinalizar_ajuste')}
            disabled={webhookStatus?.key === 'sinalizar_ajuste' && webhookStatus.status === 'sending'}
            className={`flex items-center gap-1.5 px-4 py-1.5 border rounded-full text-[11px] font-bold transition-colors ${getButtonStateClass('sinalizar_ajuste', 'border-orange-200 text-orange-500 bg-white hover:bg-orange-50')}`}
          >
            <Flag size={14} weight="bold" />
            Sinalizar ajuste
            {getButtonStatusIcon('sinalizar_ajuste')}
          </button>
        )}
        {chatButtonSettings?.resumir_conversa?.enabled && (!chatButtonSettings.resumir_conversa.position || chatButtonSettings.resumir_conversa.position === 'chat') && (
          <button
            onClick={() => handleChatButtonClick('resumir_conversa')}
            disabled={webhookStatus?.key === 'resumir_conversa' && webhookStatus.status === 'sending'}
            className={`flex items-center gap-1.5 px-4 py-1.5 border rounded-full text-[11px] font-bold transition-colors ${getButtonStateClass('resumir_conversa', 'border-emerald-200 text-emerald-600 bg-white hover:bg-emerald-50')}`}
          >
            <ChatText size={14} weight="bold" />
            Resumir conversa
            {getButtonStatusIcon('resumir_conversa')}
          </button>
        )}
      </div>

      {/* Reply Preview Bar */}
      {replyContext && (
        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1 h-8 rounded-full bg-emerald-500 flex-shrink-0" />
            <ArrowBendUpLeft size={14} weight="bold" className="text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-emerald-600 truncate">{replyContext.sender}</p>
              <p className="text-[12px] text-gray-500 truncate">{replyContext.text}</p>
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
        <div className="flex items-center gap-0 pb-0.5">
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip size={20} />
          </button>
          <button
            ref={emojiButtonRef}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`transition-colors ${showEmojiPicker
              ? 'text-blue-500'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <Smiley size={20} />
          </button>
        </div>

        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 mb-2 z-50"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.LIGHT}
              width={350}
              height={400}
              searchPlaceHolder="Buscar emoji..."
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>
        )}

        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
            if (e.key === 'Escape' && replyContext) {
              onCancelReply?.()
            }
            if (e.key === 'Escape' && showEmojiPicker) {
              setShowEmojiPicker(false)
            }
          }}
          placeholder={replyContext ? 'Digite sua resposta...' : "Digite sua mensagem ou digite '/' para comandos..."}
          className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-400 bg-transparent resize-none overflow-y-auto leading-[1.5] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          rows={1}
          style={{ maxHeight: '160px' }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
          style={{ backgroundColor: '#00B8D9' }}
        >
          <PaperPlaneRight size={16} weight="fill" />
        </button>
      </div>

      {/* Hint */}
      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
        Enter para enviar · Shift+Enter para nova linha{replyContext ? ' · Esc para cancelar reply' : ''}
      </p>
    </div>
  )
}
