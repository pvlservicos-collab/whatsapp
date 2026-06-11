import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { leads, leadActivities, pipelineStages, integrationMessageLogs } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'

/**
 * POST /api/webhooks/n8n-outbound
 * Webhook para registrar no CRM mensagens já enviadas pelo WhatsApp via n8n.
 *
 * Auth: Authorization: Bearer atl_xxx (token de API da organização)
 * Body: { phone: string, content: string, sender_name?: string }
 */
export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | null = null
  let body: any = {}

  try {
    auth = await authenticateRequest(req)
    body = await req.json()

    const requiredError = validateRequired(body, ['phone', 'content'])
    if (requiredError) return apiError(400, requiredError)

    const phone = String(body.phone).replace(/\D/g, '')

    const [existing] = await db.select({ id: leads.id, title: leads.title })
      .from(leads)
      .where(and(eq(leads.organizationId, auth.organizationId), ilike(leads.phone, `%${phone}%`), isNull(leads.deletedAt)))
      .limit(1)

    let leadId = existing?.id
    if (!leadId) {
      const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
        .where(and(eq(pipelineStages.organizationId, auth.organizationId), isNull(pipelineStages.deletedAt)))
        .orderBy(asc(pipelineStages.rank)).limit(1)

      const [newLead] = await db.insert(leads).values({
        organizationId: auth.organizationId,
        title: body.sender_name || phone,
        phone,
        stageId: firstStage?.id || null,
        lastActivityAt: new Date(),
        customAttributes: { source: 'n8n' },
      }).returning({ id: leads.id })
      leadId = newLead.id
    }

    const [activity] = await db.insert(leadActivities).values({
      organizationId: auth.organizationId,
      leadId,
      type: 'whatsapp',
      content: body.content,
      metadata: {
        source: 'n8n',
        direction: 'outbound',
        send_status: 'sent',
        sender_name: body.sender_name,
      },
    }).returning({ id: leadActivities.id })

    await db.update(leads).set({
      lastMessageContent: body.content,
      lastMessageSenderType: 'agent',
      lastActivityAt: new Date(),
    }).where(eq(leads.id, leadId))

    await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
    await publishEvent(channels.orgLeads(auth.organizationId), events.LEAD_UPDATED, { id: leadId })

    await db.insert(integrationMessageLogs).values({
      organizationId: auth.organizationId,
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
    if (auth) {
      await db.insert(integrationMessageLogs).values({
        organizationId: auth.organizationId,
        source: 'n8n',
        direction: 'outbound',
        phone: body?.phone ? String(body.phone) : null,
        content: body?.content ?? null,
        status: 'error',
        error: err.message || 'Erro interno.',
        payload: body,
      }).catch(() => {})
    }
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
