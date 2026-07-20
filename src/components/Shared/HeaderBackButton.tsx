'use client'

import { CaretLeft, X } from '@phosphor-icons/react'

interface HeaderBackButtonProps {
  onClick: () => void
  icon?: 'back' | 'close'
  variant?: 'light' | 'dark' | 'chat'
  label?: string
  className?: string
}

const VARIANT_CLASSES: Record<string, string> = {
  light: 'bg-black/[0.06] hover:bg-black/10 active:bg-black/[0.14] text-gray-700',
  dark: 'bg-white/10 hover:bg-white/15 active:bg-white/20 text-white',
  chat: 'bg-[var(--chat-bg-hover)] hover:bg-[var(--chat-border)] text-[var(--chat-text-primary)]',
}

/**
 * Botão de voltar/fechar padrão WhatsApp — círculo de 44px (mínimo recomendado
 * pela Apple/Google pra alvo de toque, funciona bem até em telas pequenas tipo
 * iPhone SE/7) com ícone grande. Usado em todo cabeçalho de tela cheia/modal
 * mobile pra manter a mesma experiência de "voltar" em qualquer lugar do app.
 */
export default function HeaderBackButton({ onClick, icon = 'close', variant = 'light', label, className = '' }: HeaderBackButtonProps) {
  const Icon = icon === 'back' ? CaretLeft : X
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || (icon === 'back' ? 'Voltar' : 'Fechar')}
      className={`w-11 h-11 min-w-11 min-h-11 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <Icon size={22} weight="bold" />
    </button>
  )
}
