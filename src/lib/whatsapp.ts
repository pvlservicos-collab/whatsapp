import { db } from '@/lib/db'
import { integrations, integrationSecrets } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function sendWhatsAppMessage(organizationId: string, phone: string, content: string) {
  const [integration] = await db.select({ id: integrations.id, config: integrations.config })
    .from(integrations)
    .where(and(
      eq(integrations.organizationId, organizationId),
      eq(integrations.type, 'whatsapp_cloud_official'),
      isNull(integrations.deletedAt),
    ))
    .limit(1)

  if (!integration) throw { status: 400, message: 'Integração com WhatsApp não configurada.' }

  const [secretRow] = await db.select({ secret: integrationSecrets.secret })
    .from(integrationSecrets)
    .where(eq(integrationSecrets.integrationId, integration.id))
    .limit(1)

  const config = integration.config as { phone_number_id?: string; graph_api_version?: string }
  const secret = secretRow?.secret as { system_token?: string } | undefined

  if (!config?.phone_number_id || !secret?.system_token) {
    throw { status: 400, message: 'Integração com WhatsApp incompleta (faltando phone_number_id ou token).' }
  }

  const apiVersion = config.graph_api_version || 'v21.0'
  const to = phone.replace(/\D/g, '')

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret.system_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: content },
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errMsg = data?.error?.message || `Falha ao enviar mensagem (HTTP ${res.status})`
    throw { status: 502, message: errMsg, details: data }
  }

  return data
}
