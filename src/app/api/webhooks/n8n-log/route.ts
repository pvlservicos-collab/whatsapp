import { NextRequest } from 'next/server'
import { apiError, validateRequired } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { integrationMessageLogs } from '@/lib/schema'

const ORGANIZATION_ID = 'bdfac9ab-68cd-4434-856c-897199dc267d'

/**
 * POST /api/webhooks/n8n-log
 * Apenas registra a mensagem na aba Logs — não cria/atualiza conversas no CRM.
 *
 * Sem autenticação (uso interno).
 * Body: { phone: string, content: string, status?: 'success' | 'error', error?: string, [extra]: any }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const requiredError = validateRequired(body, ['phone', 'content'])
    if (requiredError) return apiError(400, requiredError)

    await db.insert(integrationMessageLogs).values({
      organizationId: ORGANIZATION_ID,
      source: 'n8n',
      direction: body.direction || 'outbound',
      phone: String(body.phone),
      content: body.content,
      status: body.status === 'error' ? 'error' : 'success',
      error: body.error || null,
      payload: body,
    })

    return Response.json({ status: 'ok' })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
