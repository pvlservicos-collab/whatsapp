import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { integrationMessageLogs } from '@/lib/schema'

/**
 * POST /api/webhooks/n8n-log
 * Apenas registra a mensagem na aba Logs — não cria/atualiza conversas no CRM.
 *
 * Auth: Authorization: Bearer atl_xxx (token de API da organização)
 * Body: { phone: string, content: string, status?: 'success' | 'error', error?: string, [extra]: any }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const body = await req.json()

    const requiredError = validateRequired(body, ['phone', 'content'])
    if (requiredError) return apiError(400, requiredError)

    await db.insert(integrationMessageLogs).values({
      organizationId: auth.organizationId,
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
