import { NextRequest } from 'next/server'
import { findOrCreateLeadByFigurinhaPhone, runFigurinhaFunnel } from '@/lib/figurinha'

/**
 * POST /api/webhooks/figurinha-abandono-preco
 *
 * Webhook interno (sem autenticação) chamado quando o lead visualiza a
 * página de preço/checkout da figurinha e não finaliza a compra.
 * Dispara o funil "abandono_preco" (mensagem de desconto com {link_desconto}).
 *
 * Payload esperado:
 * { "telefone": "96991712831" }
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
    await runFigurinhaFunnel('abandono_preco', lead.id, telefone, async () => {})

    return Response.json({ ok: true, leadId: lead.id })
  } catch (err: any) {
    console.error('[/api/webhooks/figurinha-abandono-preco]', err)
    return Response.json({ ok: false, error: err.message || 'Erro interno.' }, { status: 200 })
  }
}
