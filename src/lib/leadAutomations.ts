import { db } from '@/lib/db'
import { leads, leadActivities, leadStageHistory, quickReplies, quickReplySteps, integrations } from '@/lib/schema'
import { eq, and, or, ilike, isNull, asc } from 'drizzle-orm'
import { publishEvent, channels, events } from '@/lib/realtime'
import { getChannelAdapter } from '@/lib/channels/registry'

/**
 * Etiqueta → etapa da pipeline "Atendimento WhatsApp". Ao aplicar a etiqueta no lead,
 * ele é movido automaticamente pro kanban, como se o agente tivesse arrastado o card.
 */
const TAG_STAGE_AUTOMATIONS: Record<string, string> = {
  '7030f279-97fc-4177-b0be-4add3b7f9762': '8a7e342d-278b-46c2-88b9-af6d1bd6fe3a', // COMPROU (rota) -> COMPROU ( EM ROTA...)
  'bb5fc1e4-235d-4b97-ba52-9777ca81d6cb': '138625c9-fb05-4539-bacc-075fca4d4983', // follow1 -> Follow up
}

const ENTREGUE_STAGE_ID = '89da4ea2-094a-454a-ab4e-76450769ca68' // ENTREGUE ( POS-VENDA ) 4 cadência
const POSVENDA_SHORTCUT = 'pos-venda'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Move o lead de etapa e registra no histórico, igual ao drag-and-drop manual do kanban. */
export async function moveLeadToStage(organizationId: string, leadId: string, stageId: string, movedByMemberId: string | null) {
  const [lead] = await db.select({ stageId: leads.stageId }).from(leads).where(eq(leads.id, leadId)).limit(1)
  if (!lead || lead.stageId === stageId) return

  await db.update(leads).set({ stageId, updatedAt: new Date() }).where(eq(leads.id, leadId))
  await db.insert(leadStageHistory).values({
    organizationId, leadId, fromStageId: lead.stageId || null, toStageId: stageId,
    movedByMemberId, movedAt: new Date(),
  })
  await publishEvent(channels.orgLeads(organizationId), events.LEAD_UPDATED, { id: leadId })
}

/** Chamar sempre que uma etiqueta for aplicada a um lead — move de etapa se a etiqueta tiver destino mapeado. */
export async function applyTagStageAutomation(organizationId: string, leadId: string, tagId: string, movedByMemberId: string | null) {
  const targetStageId = TAG_STAGE_AUTOMATIONS[tagId]
  if (!targetStageId) return
  await moveLeadToStage(organizationId, leadId, targetStageId, movedByMemberId)
}

/**
 * Chamar quando um pedido é marcado como entregue (delivery_status -> 'delivered').
 * Move o lead pra etapa de pós-venda na hora, e dispara a mensagem "pos-venda" (a mesma
 * resposta rápida usada manualmente no chat — editar lá reflete aqui sem mexer em código)
 * em segundo plano, sem travar a resposta da Logística caso a resposta tenha pausas
 * entre os passos.
 */
export async function handleOrderDelivered(organizationId: string, leadId: string) {
  await moveLeadToStage(organizationId, leadId, ENTREGUE_STAGE_ID, null)
  sendPosVendaMessage(organizationId, leadId).catch(err => console.error('[pos-venda] Falha inesperada:', err))
}

async function sendPosVendaMessage(organizationId: string, leadId: string) {
  const [lead] = await db.select({
    phone: leads.phone,
    externalId: leads.externalId,
    isGroup: leads.isGroup,
    integrationId: leads.integrationId,
  }).from(leads).where(eq(leads.id, leadId)).limit(1)
  if (!lead) return

  let integrationType: string | null = null
  if (lead.integrationId) {
    const [integ] = await db.select({ type: integrations.type }).from(integrations).where(eq(integrations.id, lead.integrationId)).limit(1)
    integrationType = integ?.type || null
  }

  const [quickReply] = await db.select().from(quickReplies)
    .where(and(
      eq(quickReplies.organizationId, organizationId),
      or(ilike(quickReplies.shortcut, POSVENDA_SHORTCUT), ilike(quickReplies.shortcut, `/${POSVENDA_SHORTCUT}`)),
      isNull(quickReplies.deletedAt)
    ))
    .limit(1)
  if (!quickReply) {
    console.error(`[pos-venda] Resposta rápida "${POSVENDA_SHORTCUT}" não encontrada — mensagem de pós-venda não enviada para lead ${leadId}.`)
    return
  }

  const adapter = getChannelAdapter(integrationType)
  const recipient = integrationType === 'instagram_direct' ? (lead.externalId || '') : (lead.phone || '')
  if (!recipient) {
    console.error(`[pos-venda] Lead ${leadId} sem destinatário válido — mensagem de pós-venda não enviada.`)
    return
  }

  async function logActivity(content: string, metadata: Record<string, any>) {
    const [activity] = await db.insert(leadActivities).values({
      organizationId, leadId, type: 'whatsapp', content, metadata,
    }).returning({ id: leadActivities.id })
    await db.update(leads).set({
      lastMessageContent: content, lastMessageSenderType: 'automated', lastActivityAt: new Date(), isUnread: true,
    }).where(eq(leads.id, leadId))
    await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
    await publishEvent(channels.orgLeads(organizationId), events.LEAD_UPDATED, { id: leadId })
  }

  const baseMetadata = { source: 'pos_venda_automatico', direction: 'outbound', automated: true, channel: integrationType }

  async function sendOne(content: string, mediaUrl: string | null, mediaType: string | null, mediaFilename: string | null) {
    try {
      const result = mediaUrl
        ? await adapter.sendMedia(organizationId, lead.integrationId, recipient, mediaType || 'image', mediaUrl, '', mediaFilename || undefined, lead.isGroup ?? false)
        : await adapter.sendText(organizationId, lead.integrationId, recipient, content, lead.isGroup ?? false)
      await logActivity(content, {
        ...baseMetadata, send_status: 'sent',
        ...(mediaUrl ? { media_type: mediaType, media_url: mediaUrl } : {}),
        [adapter.metadataIdKey]: result.externalId,
      })
    } catch (err: any) {
      console.error(`[pos-venda] Falha ao enviar passo (${mediaType || 'texto'}) para lead ${leadId}:`, err)
      await logActivity(content, {
        ...baseMetadata, send_status: 'failed', send_error: err.message || 'Erro ao enviar mensagem.',
        ...(mediaUrl ? { media_type: mediaType, media_url: mediaUrl } : {}),
      })
    }
  }

  const steps = await db.select().from(quickReplySteps)
    .where(eq(quickReplySteps.quickReplyId, quickReply.id))
    .orderBy(asc(quickReplySteps.position))

  if (steps.length > 0) {
    // Passo a passo (ex: áudio -> imagem -> texto), na ordem, respeitando a pausa
    // configurada depois de cada um antes de mandar o próximo.
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (step.mediaUrl) await sendOne(step.content || '', step.mediaUrl, step.mediaType, step.mediaFilename)
      else if (step.content) await sendOne(step.content, null, null, null)
      if (i < steps.length - 1 && step.delaySeconds > 0) await sleep(step.delaySeconds * 1000)
    }
    return
  }

  // Sem passos — resposta rápida simples de texto + mídia num único registro.
  if (quickReply.content) await sendOne(quickReply.content, null, null, null)
  if (quickReply.mediaUrl) await sendOne('', quickReply.mediaUrl, quickReply.mediaType, quickReply.mediaFilename)
}
