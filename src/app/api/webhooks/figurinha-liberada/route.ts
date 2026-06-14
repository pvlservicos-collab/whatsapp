import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { integrationMessageLogs } from '@/lib/schema'
import { extractPhone, sendAutomatedMessage, ORGANIZATION_ID } from '@/lib/automated-message'
import { markFunnelExecutionContext } from '@/lib/figurinha'

/**
 * POST /api/webhooks/figurinha-liberada
 * Webhook para disparo automático de mensagem de confirmação de pagamento
 * (figurinha liberada).
 *
 * Sem autenticação (uso interno). Tolerante a payloads desformatados:
 * - aceita JSON inválido/vazio
 * - aceita array (usa o primeiro item)
 * - aceita vários formatos de telefone (phone, telefone, wa_id, etc.)
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
      source: 'figurinha_liberada',
      direction: 'outbound',
      phone: phone || null,
      content: null,
      status: 'error',
      error: parseError || 'Não foi possível identificar o telefone (phone) na mensagem.',
      payload: { raw, parsed },
    }).catch(() => {})
    return Response.json({ status: 'ok', sent: false })
  }

  const content = `✅ Figurinha liberada

Pagamento confirmado! 🎉

Sua figurinha já está disponível na página abaixo 👇
https://gerarfigurinhas.vercel.app/obrigado?fone=${phone}

📌 Se não aparece automaticamente:
Utilize seu número do telefone

E aproveita que na mesma página você também acessa todos os nossos outros produtos! 👀🔥`

  const result = await sendAutomatedMessage({ phone, content, source: 'figurinha_liberada', raw, parsed })

  if (result.leadId) {
    await markFunnelExecutionContext(result.leadId, 'abandono_preco', { pagamento_confirmado: true })
  }

  return Response.json({ status: 'ok', lead_id: result.leadId, activity_id: result.activityId })
}
