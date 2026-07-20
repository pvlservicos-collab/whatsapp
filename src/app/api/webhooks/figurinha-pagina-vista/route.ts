import { NextRequest } from 'next/server'
import { findOrCreateLeadByFigurinhaPhone, markFunnelExecutionContext } from '@/lib/figurinha'

/**
 * POST /api/webhooks/figurinha-pagina-vista
 *
 * Webhook interno (sem autenticação) chamado quando o lead visualiza a
 * página da figurinha (ex: https://gerarfigurinhas.vercel.app/figurinha/{telefone}).
 * Marca o contexto da execução do funil "geracaowhatsapp" como `viu_pagina`,
 * o que impede o envio do lembrete de "Você nem chegou a ver...".
 *
 * Payload real enviado pelo app de figurinhas (campos extras são ignorados,
 * só `telefone` é usado para identificar o cliente):
 * {
 *   "event": "figurinha_pagina_vista_abandono",
 *   "telefone": "96991712831",
 *   "nome": "...",
 *   "email": null,
 *   "sticker_id": "...",
 *   "sticker_url": "...",
 *   "preview_url": "...",
 *   "link": "https://gerarfigurinhas.vercel.app/figurinha/96991712831"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    let body: any = {}
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      return Response.json({ ok: false, error: 'JSON inválido.' }, { status: 200 })
    }

    if (Array.isArray(body)) body = body[0] || {}

    const telefoneRaw = body?.telefone ?? body?.phone ?? body?.celular ?? body?.whatsapp ?? null
    const telefone = telefoneRaw != null ? String(telefoneRaw).replace(/\D/g, '') : ''

    if (!telefone) {
      return Response.json({ ok: false, error: 'Campo "telefone" ausente ou inválido.' }, { status: 200 })
    }

    const lead = await findOrCreateLeadByFigurinhaPhone(telefone)
    await markFunnelExecutionContext(lead.id, 'geracaowhatsapp', { viu_pagina: true })

    return Response.json({ ok: true, leadId: lead.id })
  } catch (err: any) {
    console.error('[/api/webhooks/figurinha-pagina-vista]', err)
    return Response.json({ ok: false, error: err.message || 'Erro interno.' }, { status: 200 })
  }
}
