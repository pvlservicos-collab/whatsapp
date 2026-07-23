import { db } from '@/lib/db'
import { publishEvent, channels, events } from '@/lib/realtime'
import { leads, leadActivities, pipelineStages, integrations, notifications } from '@/lib/schema'
import { eq, and, isNull, ilike, asc } from 'drizzle-orm'
import { getChannelAdapter } from '@/lib/channels/registry'
import { isUniqueViolation } from '@/lib/db-helpers'

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_evolution: 'Nº 2 (Evolution)',
  whatsapp_cloud_official: 'API Oficial',
  instagram_direct: 'Instagram',
}

export interface SendLeadMessageParams {
  organizationId: string
  leadId?: string
  phone?: string
  content: string
  type: 'whatsapp' | 'note' | 'email' | 'system'
  source: string
  direction?: 'inbound' | 'outbound'
  senderName?: string
  replyToMessageId?: string
  mediaUrl?: string
  mediaType?: string
  mediaFilename?: string
  caption?: string
  skipSend?: boolean
  actorMemberId?: string | null
}

/**
 * Extraído de POST /api/leads/[id]/messages — mesma lógica exata (resolve/cria lead,
 * despacha pelo channel adapter certo, insere activity, atualiza lead, publica
 * realtime), reusável tanto pela rota HTTP (humano/API externa) quanto pelo agente
 * de IA chamando direto em processo, sem round-trip HTTP.
 */
export async function sendLeadMessage(params: SendLeadMessageParams) {
  const {
    organizationId, content, type, source,
    direction = 'outbound', senderName, replyToMessageId,
    mediaUrl, mediaType, mediaFilename, caption, skipSend, actorMemberId = null,
  } = params

  const isUuid = params.leadId
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.leadId)
    : false
  const decodedPhone = params.phone || ''

  let leadQuery = db
    .select({ id: leads.id, title: leads.title, phone: leads.phone, isGroup: leads.isGroup, externalId: leads.externalId, integrationId: leads.integrationId })
    .from(leads)
    .where(
      and(
        eq(leads.organizationId, organizationId),
        isNull(leads.deletedAt),
        isUuid ? eq(leads.id, params.leadId!) : eq(leads.phone, decodedPhone)
      )
    )
    .limit(1)

  const [lead] = await leadQuery
  let actualLeadId = lead?.id

  if (!actualLeadId) {
    if (isUuid) throw { status: 404, message: 'Lead não encontrado.' }

    const [firstStage] = await db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, organizationId), isNull(pipelineStages.deletedAt)))
      .orderBy(asc(pipelineStages.rank))
      .limit(1)

    try {
      const [newLead] = await db
        .insert(leads)
        .values({
          organizationId,
          title: senderName || decodedPhone,
          phone: decodedPhone,
          stageId: firstStage?.id || null,
          lastActivityAt: new Date(),
          customAttributes: { source },
        })
        .returning({ id: leads.id })
      actualLeadId = newLead.id
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const [raceLead] = await db.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.organizationId, organizationId), eq(leads.phone, decodedPhone), isNull(leads.deletedAt)))
        .limit(1)
      if (!raceLead) throw err
      actualLeadId = raceLead.id
    }
  }

  const metadata: Record<string, any> = { source, direction }
  if (senderName) metadata.sender_name = senderName
  if (replyToMessageId) metadata.reply_to_message_id = replyToMessageId
  if (mediaUrl) metadata.media_url = mediaUrl
  if (mediaType) metadata.media_type = mediaType

  if (direction === 'outbound' && type === 'whatsapp' && !skipSend) {
    const phone = lead?.phone || decodedPhone

    let integrationTyp = 'whatsapp_cloud_official'
    let leadIntegrationId: string | null = null
    if (lead?.integrationId) {
      leadIntegrationId = lead.integrationId
      const [integ] = await db.select({ type: integrations.type }).from(integrations)
        .where(eq(integrations.id, lead.integrationId)).limit(1)
      if (integ?.type) integrationTyp = integ.type
    }
    metadata.channel = integrationTyp

    try {
      const adapter = getChannelAdapter(integrationTyp)

      if (lead?.isGroup && !adapter.supportsGroups) {
        throw new Error('Grupos só podem ser respondidos pela Evolution API — este canal não suporta grupos.')
      }

      const recipient = integrationTyp === 'instagram_direct' ? (lead?.externalId || '') : phone
      if (integrationTyp === 'instagram_direct' && !recipient) {
        throw new Error('Lead do Instagram sem external_id (IGSID) — não é possível enviar.')
      }

      const mediaCaption = typeof caption === 'string' ? caption : ''

      const result = mediaUrl
        ? await adapter.sendMedia(organizationId, leadIntegrationId, recipient, mediaType as any, mediaUrl, mediaCaption, mediaFilename, lead?.isGroup ?? false)
        : await adapter.sendText(organizationId, leadIntegrationId, recipient, content, lead?.isGroup ?? false)

      metadata.send_status = 'sent'
      if (result.externalId) metadata[adapter.metadataIdKey] = result.externalId
    } catch (err: any) {
      metadata.send_status = 'failed'
      metadata.send_error = err.message || 'Erro ao enviar mensagem.'

      console.error(`[messages] Falha ao enviar ${mediaType ? `mídia (${mediaType})` : 'texto'} via ${integrationTyp} para lead ${actualLeadId}:`, err)

      if (actorMemberId) {
        const channelLabel = CHANNEL_LABELS[integrationTyp] || 'API Oficial'
        db.insert(notifications).values({
          organizationId,
          recipientMemberId: actorMemberId,
          type: 'error',
          title: 'Falha ao enviar mensagem',
          body: `Não foi possível enviar a mensagem para ${lead?.title || phone} via ${channelLabel}: ${metadata.send_error}`,
          metadata: { linkUrl: `/chat?leadId=${actualLeadId}`, leadId: actualLeadId },
        }).catch(notifErr => console.error('[messages] Falha ao gravar notificação de erro:', notifErr))
      }
    }
  } else if (direction === 'outbound' && type === 'whatsapp' && skipSend) {
    metadata.send_status = 'sent'
  }

  const [activity] = await db
    .insert(leadActivities)
    .values({
      organizationId,
      leadId: actualLeadId!,
      actorMemberId,
      type,
      content,
      metadata,
    })
    .returning({ id: leadActivities.id, content: leadActivities.content, createdAt: leadActivities.createdAt })

  const updates: any = {
    lastMessageContent: content,
    lastMessageSenderType: direction === 'inbound' ? 'lead' : source,
    lastActivityAt: new Date(),
    lastActivityType: type,
    lastActivityByMemberId: actorMemberId,
    isUnread: direction === 'inbound',
  }

  if (senderName && lead) {
    const title = lead.title?.trim() || ''
    if (!title || title === 'Desconhecido' || title === lead.phone || title === decodedPhone) {
      updates.title = senderName
    }
  }

  if (direction === 'outbound' && type === 'whatsapp') {
    const [stage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, organizationId), isNull(pipelineStages.deletedAt), ilike(pipelineStages.name, 'Em atendimento')))
      .limit(1)
    if (stage) updates.stageId = stage.id
  }

  await db.update(leads).set(updates).where(eq(leads.id, actualLeadId!))

  await publishEvent(channels.leadActivities(actualLeadId!), events.ACTIVITY_CREATED, { id: activity.id })
  await publishEvent(channels.orgLeads(organizationId), events.LEAD_UPDATED, { id: actualLeadId! })

  return {
    activity,
    leadId: actualLeadId!,
    leadName: lead?.title,
    sendStatus: metadata.send_status as string | undefined,
    sendError: metadata.send_error as string | undefined,
    channel: metadata.channel as string | undefined,
  }
}
