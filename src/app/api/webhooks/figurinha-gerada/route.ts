import { NextRequest } from 'next/server'
import { findOrCreateLeadByFigurinhaPhone, runFigurinhaFunnel } from '@/lib/figurinha'

/**
 * POST /api/webhooks/figurinha-gerada
 *
 * Webhook interno (sem autenticação) chamado por outro sistema quando uma
 * figurinha é gerada para um número de telefone. Envia ao lead correspondente
 * uma mensagem com o link da figurinha e dispara o gatilho de funil
 * "geracaowhatsapp" (se houver algum funil ativo configurado).
 *
 * Payload esperado:
 * {
 *   "telefone": "96991712831",   // DDD + número, sem +55
 *   "mensagem": "Figurinha gerada para o telefone 96991712831"
 * }
 *
 * Como o número avisado aqui é apenas um identificador que o usuário envia
 * de volta numa mensagem do WhatsApp (ex: "Quero minha figurinha
 * Nº#96991712831"), a prioridade é procurar uma mensagem recebida que contenha
 * esse número (ex: "#96991712831") para linkar com a conversa certa. Se não
 * encontrar, cai para o match direto pelo telefone do lead.
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

    // Registra o lead mas não envia nenhuma mensagem (automação desligada)
    const lead = await findOrCreateLeadByFigurinhaPhone(telefone)

    if (lead?.phone) {
      await runFigurinhaFunnel('geracaowhatsapp', lead.id, telefone, async () => {})
    }

    return Response.json({ ok: true, leadId: lead.id })
  } catch (err: any) {
    console.error('[/api/webhooks/figurinha-gerada]', err)
    return Response.json({ ok: false, error: err.message || 'Erro interno.' }, { status: 200 })
  }
}
