import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { integrationMessageLogs } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/logs
 * Lista os logs de mensagens recebidos via webhooks de integrações externas (ex: n8n)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const data = await db.select()
      .from(integrationMessageLogs)
      .where(eq(integrationMessageLogs.organizationId, auth.organizationId))
      .orderBy(desc(integrationMessageLogs.createdAt))
      .limit(limit)

    const result = data.map((l) => ({
      id: l.id,
      source: l.source,
      direction: l.direction,
      phone: l.phone,
      content: l.content,
      lead_id: l.leadId,
      status: l.status,
      error: l.error,
      payload: l.payload,
      created_at: l.createdAt,
    }))

    return Response.json({ data: result })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
