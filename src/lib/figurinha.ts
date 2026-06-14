import { db } from '@/lib/db'
import { leads, leadActivities, messageFunnels, pipelineStages, funnelExecutions } from '@/lib/schema'
import { eq, and, isNull, ilike, asc, desc, sql, inArray } from 'drizzle-orm'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { publishEvent, channels, events } from '@/lib/realtime'
import { ORGANIZATION_ID } from '@/lib/automated-message'
import { startExecution } from '@/lib/funnel-engine'

/**
 * Mensagem enviada automaticamente quando o cliente pede a figurinha
 * (ex: "Quero minha figurinha Numero #96991712831"), enquanto ela é gerada.
 */
export const FIGURINHA_BUSCANDO_MESSAGE =
  'Olá! Já encontrei seu cadastro, buscando sua figurinha... (pode levar até 1 minuto) ⏳'

/**
 * Números de teste cuja figurinha já deve ser considerada pronta
 * imediatamente, sem aguardar o webhook externo de confirmação.
 */
export const FIGURINHA_READY_TEST_NUMBERS = new Set(['96991712831'])

/**
 * Extrai o número informado em mensagens do tipo
 * "Quero minha figurinha Numero #96991712831".
 */
export function extractFigurinhaNumero(text: string): string | null {
  const match = text.match(/figurinha[^\d#]*#?\s*(\d{8,15})/i)
  return match ? match[1] : null
}

export function buildFigurinhaProntaMessage(telefone: string) {
  const link = `https://gerarfigurinhas.vercel.app/figurinha/${telefone}`
  return `✅ Figurinha pronta!\n\nSua figurinha já está disponível, confira pelo link:\n${link}`
}

/**
 * Localiza o lead correspondente a um telefone informado em webhooks de
 * figurinha: 1) procura uma mensagem inbound contendo o número; 2) procura
 * pelo telefone do lead; 3) cria um novo lead.
 */
export async function findOrCreateLeadByFigurinhaPhone(telefone: string): Promise<{ id: string; phone: string | null }> {
  const [match] = await db.select({ leadId: leadActivities.leadId })
    .from(leadActivities)
    .where(and(
      eq(leadActivities.organizationId, ORGANIZATION_ID),
      sql`${leadActivities.metadata}->>'direction' = 'inbound'`,
      ilike(leadActivities.content, `%${telefone}%`),
    ))
    .orderBy(desc(leadActivities.createdAt))
    .limit(1)

  let leadId = match?.leadId

  if (!leadId) {
    const [leadByPhone] = await db.select({ id: leads.id })
      .from(leads)
      .where(and(
        eq(leads.organizationId, ORGANIZATION_ID),
        isNull(leads.deletedAt),
        ilike(leads.phone, `%${telefone}`),
      ))
      .limit(1)

    leadId = leadByPhone?.id
  }

  if (!leadId) {
    const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, ORGANIZATION_ID), isNull(pipelineStages.deletedAt)))
      .orderBy(asc(pipelineStages.rank)).limit(1)

    const phone = telefone.length <= 11 ? `55${telefone}` : telefone

    const [newLead] = await db.insert(leads).values({
      organizationId: ORGANIZATION_ID,
      title: phone,
      phone,
      stageId: firstStage?.id || null,
      lastActivityAt: new Date(),
      customAttributes: { source: 'geracaowhatsapp' },
    }).returning({ id: leads.id, phone: leads.phone })

    return { id: newLead.id, phone: newLead.phone }
  }

  const [lead] = await db.select({ id: leads.id, phone: leads.phone }).from(leads).where(eq(leads.id, leadId)).limit(1)
  return lead
}

/**
 * Atualiza o contexto das execuções de funil em andamento de um lead para os
 * gatilhos informados, mesclando os campos de `patch` (ex: { viu_pagina: true }).
 * Usado para sinalizar eventos externos (página vista, pagamento confirmado)
 * que serão checados pelas condições durante o `processTick`.
 */
export async function markFunnelExecutionContext(leadId: string, trigger: string, patch: Record<string, any>) {
  const funnels = await db.select({ id: messageFunnels.id }).from(messageFunnels)
    .where(and(eq(messageFunnels.organizationId, ORGANIZATION_ID), eq(messageFunnels.trigger, trigger as any)))

  if (funnels.length === 0) return

  const funnelIds = funnels.map(f => f.id)

  const executions = await db.select({ id: funnelExecutions.id, context: funnelExecutions.context })
    .from(funnelExecutions)
    .where(and(
      eq(funnelExecutions.leadId, leadId),
      inArray(funnelExecutions.funnelId, funnelIds),
      inArray(funnelExecutions.status, ['running', 'waiting', 'waiting_condition']),
    ))

  for (const exec of executions) {
    await db.update(funnelExecutions).set({
      context: { ...(exec.context as object), ...patch },
      updatedAt: new Date(),
    }).where(eq(funnelExecutions.id, exec.id))
  }
}

/**
 * Envia uma mensagem automática de texto para um lead, registra a atividade
 * no CRM, atualiza o lead e publica os eventos de tempo real.
 */
export async function sendFigurinhaAutoMessage(leadId: string, phone: string, content: string, source: string) {
  const metadata: Record<string, any> = {
    source,
    direction: 'outbound',
    automated: true,
  }

  try {
    const result = await sendWhatsAppMessage(ORGANIZATION_ID, phone, content)
    metadata.whatsapp_message_id = result?.messages?.[0]?.id
    metadata.send_status = 'sent'
  } catch (err: any) {
    metadata.send_status = 'failed'
    metadata.send_error = err.message || 'Erro ao enviar mensagem.'
  }

  const [activity] = await db.insert(leadActivities).values({
    organizationId: ORGANIZATION_ID,
    leadId,
    type: 'whatsapp',
    content,
    metadata,
  }).returning({ id: leadActivities.id })

  await db.update(leads).set({
    lastMessageContent: content,
    lastMessageSenderType: 'automated',
    lastActivityAt: new Date(),
    isUnread: true,
  }).where(eq(leads.id, leadId))

  await publishEvent(channels.leadActivities(leadId), events.ACTIVITY_CREATED, { id: activity.id })
  await publishEvent(channels.orgLeads(ORGANIZATION_ID), events.LEAD_UPDATED, { id: leadId })

  return metadata
}

/**
 * Dispara o funil ativo correspondente ao gatilho informado, passando o
 * telefone da figurinha no contexto da execução (usado por {link_figurinha}).
 * Se não houver funil ativo com esse gatilho, executa o fallback (mensagem fixa).
 */
export async function runFigurinhaFunnel(
  trigger: 'pedido_figurinha' | 'geracaowhatsapp' | 'abandono_preco',
  leadId: string,
  telefone: string,
  fallback: () => Promise<unknown>
) {
  const funnels = await db.select({ id: messageFunnels.id }).from(messageFunnels)
    .where(and(
      eq(messageFunnels.organizationId, ORGANIZATION_ID),
      eq(messageFunnels.trigger, trigger),
      eq(messageFunnels.isActive, true),
      isNull(messageFunnels.deletedAt),
    ))

  if (funnels.length === 0) {
    await fallback()
    return
  }

  for (const funnel of funnels) {
    await startExecution(funnel.id, ORGANIZATION_ID, leadId, { telefone })
  }
}
