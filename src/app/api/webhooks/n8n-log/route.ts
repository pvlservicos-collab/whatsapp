import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { integrationMessageLogs } from '@/lib/schema'

const ORGANIZATION_ID = 'bdfac9ab-68cd-4434-856c-897199dc267d'

/**
 * POST /api/webhooks/n8n-log
 * Apenas registra a mensagem na aba Logs — não cria/atualiza conversas no CRM.
 *
 * Sem autenticação (uso interno).
 * Aceita tanto { phone, content, ... } quanto a resposta crua da API do WhatsApp
 * (com "contacts" e "messages"), de onde phone/whatsapp_message_id são extraídos.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const phone = body.phone || body.contacts?.[0]?.wa_id || body.contacts?.[0]?.input || null
    const content = body.content ?? null
    const whatsappMessageId = body.whatsapp_message_id || body.messages?.[0]?.id || null
    const messageStatus = body.message_status || body.messages?.[0]?.message_status || null

    await db.insert(integrationMessageLogs).values({
      organizationId: ORGANIZATION_ID,
      source: 'n8n',
      direction: body.direction || 'outbound',
      phone: phone ? String(phone) : null,
      content,
      status: body.status === 'error' ? 'error' : 'success',
      error: body.error || null,
      payload: { ...body, whatsapp_message_id: whatsappMessageId, message_status: messageStatus },
    })

    return Response.json({ status: 'ok' })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
