'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowSquareOut, PencilSimple, WarningCircle } from '@phosphor-icons/react'
import { LeadWithOwner } from '@/lib/types'
import { PAYMENT_STATUS_META, DELIVERY_STATUS_META, TONE_STYLES } from '@/lib/orderStatus'
import OrderDetailModal, { OrderDetail } from '@/app/(authenticated)/logistica/OrderDetailModal'

interface OrderSummary {
  id: string
  payment_status: string
  delivery_status: string
  total_value: string
  created_at: string
  items: { id: string; product_name: string; quantity: number }[]
}

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Etapa "COMPROU (EM ROTA)" do Pipeline — o lead pode chegar aqui tanto pela etiqueta
// automática "COMPROU (rota)" (ver src/lib/leadAutomations.ts) quanto por arrasto manual
// no board do Pipeline. Os dois caminhos "fecham" o negócio aos olhos de quem vende, mas
// nenhum dos dois cria o pedido sozinho — só o botão "Marcar venda concluída" faz isso.
// Checar pela ETAPA (não pela etiqueta) cobre os dois jeitos de chegar nesse estado.
const COMPROU_STAGE_ID = '8a7e342d-278b-46c2-88b9-af6d1bd6fe3a'

interface LeadOrderCardProps {
  lead: LeadWithOwner
  /** Incrementar para forçar recarregar (ex: depois de registrar uma venda nova). */
  refreshKey?: number
}

export default function LeadOrderCard({ lead, refreshKey }: LeadOrderCardProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPayment, setSavingPayment] = useState(false)
  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?lead_id=${lead.id}&limit=5`)
      if (res.ok) {
        const { data } = await res.json()
        setOrders(data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => { fetchOrders() }, [fetchOrders, refreshKey])

  if (loading) return null

  if (orders.length === 0) {
    if (lead.stage_id !== COMPROU_STAGE_ID) return null
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
        <WarningCircle size={16} weight="fill" className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-600">
          Lead está na etapa "Comprou", mas ainda sem pedido registrado. Clique em "Marcar venda concluída" abaixo pra ele aparecer na Logística.
        </p>
      </div>
    )
  }

  const latest = orders[0]
  const mainItem = latest.items[0]?.product_name || '—'
  const extraItems = latest.items.length > 1 ? `+${latest.items.length - 1}` : ''

  // Só pagamento é editável por aqui — a entrega é responsabilidade da Logística
  // (quem gerencia o motoboy), pra evitar que o vendedor mude por engano no Chat.
  const handlePaymentChange = async (value: string) => {
    setSavingPayment(true)
    try {
      const res = await fetch(`/api/orders/${latest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: value }),
      })
      if (res.ok) {
        setOrders(prev => prev.map((o, i) => (i === 0 ? { ...o, payment_status: value } : o)))
      }
    } finally {
      setSavingPayment(false)
    }
  }

  // Endereço e pagamento editáveis pelo vendedor; entrega e repasse de dinheiro
  // continuam só-leitura (modo "sellerView") — quem mexe nisso é a Logística.
  const handleOpenDetail = async () => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/orders/${latest.id}`)
      if (res.ok) {
        const { data } = await res.json()
        setDetailOrder(data)
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-bg-panel)] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--chat-text-muted)]">Pedido</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenDetail}
            disabled={loadingDetail}
            className="flex items-center gap-1 text-[10px] font-medium text-[var(--chat-accent)] hover:text-[var(--chat-accent-hover)] disabled:opacity-50"
          >
            <PencilSimple size={10} weight="bold" />
            {loadingDetail ? 'Abrindo...' : 'Editar'}
          </button>
          <p className="text-[10px] text-[var(--chat-text-tertiary)]">{formatDate(latest.created_at)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--chat-text-secondary)] truncate">{mainItem}{extraItems ? ` ${extraItems}` : ''}</p>
        <p className="text-sm font-bold text-[var(--chat-accent)] flex-shrink-0">{formatCurrency(latest.total_value)}</p>
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--chat-text-tertiary)]">Pagamento</p>
          <select
            value={latest.payment_status}
            disabled={savingPayment}
            onChange={e => handlePaymentChange(e.target.value)}
            className="text-[11px] font-bold px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer"
            style={TONE_STYLES[PAYMENT_STATUS_META[latest.payment_status]?.tone || 'warning']}
          >
            {Object.entries(PAYMENT_STATUS_META).map(([val, meta]) => (
              <option key={val} value={val} className="bg-[var(--chat-bg-menu)] text-[var(--chat-text-secondary)]">{meta.label}</option>
            ))}
          </select>
        </div>
        {/* Entrega: somente leitura no Chat — quem gerencia o motoboy é a Logística */}
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--chat-text-tertiary)]">Entrega</p>
          <span
            title="Status de entrega — só pode ser alterado na Logística"
            className="inline-block text-[11px] font-bold px-2 py-1 rounded-full"
            style={TONE_STYLES[DELIVERY_STATUS_META[latest.delivery_status]?.tone || 'warning']}
          >
            {DELIVERY_STATUS_META[latest.delivery_status]?.label || latest.delivery_status}
          </span>
        </div>
      </div>

      {orders.length > 1 && (
        <a
          href={`/logistica?search=${encodeURIComponent(lead.phone || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--chat-accent)] hover:underline pt-0.5"
        >
          Ver todos os pedidos ({orders.length})
          <ArrowSquareOut size={11} weight="bold" />
        </a>
      )}

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          sellerView
          onClose={() => setDetailOrder(null)}
          onUpdate={(orderId, updates) => setOrders(prev => prev.map((o, i) => (i === 0 && o.id === orderId ? { ...o, ...updates } : o)))}
        />
      )}
    </div>
  )
}
