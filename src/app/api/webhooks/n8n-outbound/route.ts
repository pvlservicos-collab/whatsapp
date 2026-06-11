import { NextRequest } from 'next/server'
import { apiError, validateRequired } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { leads, leadActivities, pipelineStages, integrationMessageLogs } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'

const ORGANIZATION_ID = 'bdfac9ab-68cd-4434-856c-897199dc267d'

/**
 * POST /api/webhooks/n8n-outbound
 * Webhook para registrar no CRM mensagens já enviadas pelo WhatsApp via n8n.
 *
 * Sem autenticação (uso interno).
 * Body: { phone: string, content: string, sender_name?: string }
 */
export async function POST(req: NextRequest) {
  let body: any = {}

  try {
    body = await req.json()

    const requiredError = validateRequired(body, ['phone', 'content'])
    if (requiredError) return apiError(400, requiredError)

    const phone = String(body.phone).replace(/\D/g, '')

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
        title: body.sender_name || phone,
        phone,
        stageId: firstStage?.id || null,
        lastActivityAt: new Date(),
        customAttributes: { source: 'n8n' },
      }).returning({ id: leads.id })
      leadId = newLead.id
    }

    const [activity] = await db.insert(leadActivities).values({
      organizationId: ORGANIZATION_ID,
      leadId,
      type: 'whatsapp',
      content: body.content,
      metadata: {
        source: 'n8n',
        direction: 'outbound',
        send_status: 'sent',
        sender_name: body.sender_name,
        whatsapp_message_id: body.whatsapp_message_id,
        whatsapp_status: body.message_status,
      },
    }).returning({ id: leadActivities.id })

    await db.update(leads).set({
      lastMessageContent: body.content,
      lastMessageSenderType: 'agent',
      lastActivityAt: new Date(),
    }).where(eq(leads.id, leadId))

    await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
    await publishEvent(channels.orgLeads(ORGANIZATION_ID), events.LEAD_UPDATED, { id: leadId })

    await db.insert(integrationMessageLogs).values({
      organizationId: ORGANIZATION_ID,
      source: 'n8n',
      direction: 'outbound',
      phone,
      content: body.content,
      leadId,
      status: 'success',
      payload: body,
    })

    return Response.json({ status: 'ok', lead_id: leadId, activity_id: activity.id })
  } catch (err: any) {
    await db.insert(integrationMessageLogs).values({
      organizationId: ORGANIZATION_ID,
      source: 'n8n',
      direction: 'outbound',
      phone: body?.phone ? String(body.phone) : null,
      content: body?.content ?? null,
      status: 'error',
      error: err.message || 'Erro interno.',
      payload: body,
    }).catch(() => {})
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
