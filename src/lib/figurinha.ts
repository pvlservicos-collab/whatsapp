import { db } from '@/lib/db'
import { leads, leadActivities } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { publishEvent, channels, events } from '@/lib/realtime'
import { ORGANIZATION_ID } from '@/lib/automated-message'

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
