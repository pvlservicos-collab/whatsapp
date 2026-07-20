import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { leads, leadActivities, pipelineStages, integrationMessageLogs, tags, leadTags } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'
import { extractPhone, ORGANIZATION_ID } from '@/lib/automated-message'

const UPSELL_CONTENT = `🚨 Oferta liberada para quem já comprou!

A segunda figurinha está com 39% OFF:

❌ De R$ 12,90
✅ Por apenas R$ 7,90

Agora você pode fazer para:
👧 Irmãos
👧 Irmãs
👧 Sobrinhos
⚽ Primos
🎁 Afilhados

A promoção é válida por tempo limitado. Responda EU QUERO e envie a próxima foto.`

/**
 * POST /api/webhooks/upsell-segunda-figurinha
 * Registra no CRM a mensagem de upsell da segunda figurinha já enviada pelo N8N.
 * Não envia nenhuma mensagem nova nem dispara funis.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text()

  let parsed: any = null
  let parseError: string | null = null
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch (err: any) {
    parseError = `JSON inválido: ${err.message}`
  }

  const body = Array.isArray(parsed) ? (parsed[0] ?? {}) : (parsed ?? {})
  const phone = extractPhone(body)

  if (parseError || !phone) {
    await db.insert(integrationMessageLogs).values({
      organizationId: ORGANIZATION_ID,
      source: 'upsell_segunda_figurinha',
      direction: 'outbound',
      phone: phone || null,
      content: null,
      status: 'error',
      error: parseError || 'Não foi possível identificar o telefone na mensagem.',
      payload: { raw, parsed },
    }).catch(() => {})
    return Response.json({ status: 'ok', sent: false })
  }

  const [existing] = await db.select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.organizationId, ORGANIZATION_ID), ilike(leads.phone, `%${phone}%`), isNull(leads.deletedAt)))
    .limit(1)

  let leadId = existing?.id
  if (!leadId) {
    const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, ORGANIZATION_ID), isNull(pipelineStages.deletedAt)))
      .orderBy(asc(pipelineStages.rank)).limit(1)

    const [newLead] = await db.insert(leads).values({
      organizationId: ORGANIZATION_ID,
      title: phone,
      phone,
      stageId: firstStage?.id || null,
      lastActivityAt: new Date(),
      customAttributes: { source: 'upsell_segunda_figurinha' },
    }).returning({ id: leads.id })
    leadId = newLead.id
  }

  // Adiciona tag "Upsell" para identificar leads que receberam a oferta
  let [upsellTag] = await db.select({ id: tags.id }).from(tags)
    .where(and(eq(tags.organizationId, ORGANIZATION_ID), ilike(tags.name, 'Upsell')))
    .limit(1)
  if (!upsellTag) {
    ;[upsellTag] = await db.insert(tags).values({
      organizationId: ORGANIZATION_ID,
      name: 'Upsell',
      color: '#f59e0b',
    }).returning({ id: tags.id })
  }
  await db.insert(leadTags).values({ leadId, tagId: upsellTag.id, organizationId: ORGANIZATION_ID }).onConflictDoNothing()

  const whatsappMessageId = body.messages?.[0]?.id ?? null

  const [activity] = await db.insert(leadActivities).values({
    organizationId: ORGANIZATION_ID,
    leadId,
    type: 'whatsapp',
    content: UPSELL_CONTENT,
    metadata: {
      source: 'upsell_segunda_figurinha',
      direction: 'outbound',
      send_status: 'sent',
      automated: true,
      whatsapp_message_id: whatsappMessageId,
    },
  }).returning({ id: leadActivities.id })

  await db.update(leads).set({
    lastMessageContent: UPSELL_CONTENT,
    lastMessageSenderType: 'automated',
    lastActivityAt: new Date(),
    isUnread: true,
  }).where(eq(leads.id, leadId))

  await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
  await publishEvent(channels.orgLeads(ORGANIZATION_ID), events.LEAD_UPDATED, { id: leadId })

  await db.insert(integrationMessageLogs).values({
    organizationId: ORGANIZATION_ID,
    source: 'upsell_segunda_figurinha',
    direction: 'outbound',
    phone,
    content: UPSELL_CONTENT,
    leadId,
    status: 'success',
    payload: { raw, parsed },
  })

  return Response.json({ status: 'ok', lead_id: leadId, activity_id: activity.id })
}
