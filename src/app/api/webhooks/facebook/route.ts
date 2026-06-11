/**
 * POST/GET /api/webhooks/facebook
 * Webhook para receber mensagens da API Oficial do Facebook/WhatsApp Cloud
 *
 * GET  → Verificação do webhook pelo Facebook (hub.challenge)
 * POST → Receber mensagens inbound
 *
 * Configure no Facebook Developers:
 *   URL: https://seu-app.vercel.app/api/webhooks/facebook?org_id=SEU_ORG_ID
 *   Verify Token: valor de FACEBOOK_WEBHOOK_VERIFY_TOKEN
 */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { leads, leadActivities, pipelineStages } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[Facebook Webhook] payload:', JSON.stringify(body))

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]

    if (!message) return Response.json({ status: 'ignored: no message' })

    // Resolve org_id: URL param (legado) ou via WABA ID no payload
    let orgId = new URL(req.url).searchParams.get('org_id')
    if (!orgId) {
      const wabaId = entry?.id as string | undefined
      if (wabaId) {
        const { integrations } = await import('@/lib/schema')
        const { sql } = await import('drizzle-orm')
        const [found] = await db.select({ organizationId: integrations.organizationId })
          .from(integrations)
          .where(sql`${integrations.config}->>'waba_id' = ${wabaId}`)
          .limit(1)
        orgId = found?.organizationId ?? null
      }
    }

    if (!orgId) return Response.json({ status: 'ignored: org not found' })

    // Detecta "echo" de mensagem enviada pelo próprio número (ex: enviada via app oficial do WhatsApp)
    const ownNumber = (value?.metadata?.display_phone_number || '').replace(/\D/g, '')
    const fromNumber = (message.from || '').replace(/\D/g, '')
    const isOutboundEcho = !!ownNumber && ownNumber === fromNumber

    const phone = isOutboundEcho ? (value?.contacts?.[0]?.wa_id || message.from) : message.from
    const content = message.text?.body || (message.type === 'image' ? '📷 Imagem' : '[Mídia recebida]')
    const senderName = value?.contacts?.[0]?.profile?.name || phone

    // Buscar ou criar lead
    const [existing] = await db.select({ id: leads.id }).from(leads)
      .where(and(eq(leads.organizationId, orgId), ilike(leads.phone, `%${phone}%`), isNull(leads.deletedAt)))
      .limit(1)

    let leadId = existing?.id
    if (!leadId) {
      const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
        .where(and(eq(pipelineStages.organizationId, orgId), isNull(pipelineStages.deletedAt)))
        .orderBy(asc(pipelineStages.rank)).limit(1)

      const [newLead] = await db.insert(leads).values({
        organizationId: orgId,
        title: senderName,
        phone,
        stageId: firstStage?.id || null,
        lastActivityAt: new Date(),
      }).returning({ id: leads.id })
      leadId = newLead.id
    }

    const [activity] = await db.insert(leadActivities).values({
      organizationId: orgId,
      leadId,
      type: 'whatsapp',
      content,
      metadata: {
        direction: isOutboundEcho ? 'outbound' : 'inbound',
        source: isOutboundEcho ? 'whatsapp_app' : 'facebook_cloud',
        sender_name: senderName,
      },
    }).returning({ id: leadActivities.id })

    await db.update(leads).set({
      lastMessageContent: content,
      lastMessageSenderType: isOutboundEcho ? 'agent' : 'lead',
      lastActivityAt: new Date(),
      isUnread: !isOutboundEcho,
    }).where(eq(leads.id, leadId))

    await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
    await publishEvent(channels.orgLeads(orgId), events.LEAD_UPDATED, { id: leadId })

    return Response.json({ status: 'ok' })
  } catch (err: any) {
    console.error('[Facebook Webhook]', err)
    return Response.json({ status: 'error', message: err.message }, { status: 500 })
  }
}
