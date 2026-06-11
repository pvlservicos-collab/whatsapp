import { db } from '@/lib/db'
import { leads, leadActivities, pipelineStages, integrationMessageLogs } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'

export const ORGANIZATION_ID = 'bdfac9ab-68cd-4434-856c-897199dc267d'

/**
 * Registra no CRM uma mensagem automática (template) como se tivesse sido
 * enviada pelo número oficial da API — sem enviar de fato, pois o disparo
 * real já é feito por outro sistema (ex: API oficial do gateway de pagamento).
 * Cria/atualiza o lead conforme necessário.
 */
export async function sendAutomatedMessage(opts: {
  phone: string
  content: string
  source: string
  raw: string
  parsed: any
}) {
  const { phone, content, source, raw, parsed } = opts

  const [existing] = await db.select({ id: leads.id, title: leads.title })
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
      customAttributes: { source },
    }).returning({ id: leads.id })
    leadId = newLead.id
  }

  const [activity] = await db.insert(leadActivities).values({
    organizationId: ORGANIZATION_ID,
    leadId,
    type: 'whatsapp',
    content,
    metadata: {
      source,
      direction: 'outbound',
      send_status: 'sent',
      automated: true,
    },
  }).returning({ id: leadActivities.id })

  await db.update(leads).set({
    lastMessageContent: content,
    lastMessageSenderType: 'agent',
    lastActivityAt: new Date(),
  }).where(eq(leads.id, leadId))

  await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
  await publishEvent(channels.orgLeads(ORGANIZATION_ID), events.LEAD_UPDATED, { id: leadId })

  await db.insert(integrationMessageLogs).values({
    organizationId: ORGANIZATION_ID,
    source,
    direction: 'outbound',
    phone,
    content,
    leadId,
    status: 'success',
    payload: { raw, parsed },
  })

  return { leadId, activityId: activity.id }
}

/**
 * Extrai o telefone de um payload de webhook de forma tolerante,
 * aceitando vários formatos comuns (n8n, gateways de pagamento, etc).
 */
export function extractPhone(body: any): string {
  const rawPhone =
    body?.phone ??
    body?.telefone ??
    body?.celular ??
    body?.whatsapp ??
    body?.wa_id ??
    body?.customer?.phone ??
    body?.customer?.cellphone ??
    body?.cliente?.telefone ??
    body?.contacts?.[0]?.wa_id ??
    body?.contacts?.[0]?.input ??
    null

  return rawPhone != null ? String(rawPhone).replace(/\D/g, '') : ''
}
