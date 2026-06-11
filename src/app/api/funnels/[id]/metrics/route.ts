import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { messageFunnels, funnelExecutions, funnelClickEvents, funnelResponseEvents } from '@/lib/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'

/**
 * GET /api/funnels/[id]/metrics
 * Métricas por bloco: cliques em links rastreáveis e taxa de resposta (Sim/Não).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(req)
    const { id } = await params

    const [funnel] = await db.select({ id: messageFunnels.id }).from(messageFunnels)
      .where(and(eq(messageFunnels.id, id), eq(messageFunnels.organizationId, auth.organizationId), isNull(messageFunnels.deletedAt)))
      .limit(1)
    if (!funnel) return apiError(404, 'Funil não encontrado.')

    const clicks = await db.select({
      blockId: funnelClickEvents.blockId,
      total: sql<number>`count(*)::int`,
      clicados: sql<number>`count(*) filter (where ${funnelClickEvents.clicked})::int`,
    }).from(funnelClickEvents)
      .innerJoin(funnelExecutions, eq(funnelExecutions.id, funnelClickEvents.executionId))
      .where(eq(funnelExecutions.funnelId, id))
      .groupBy(funnelClickEvents.blockId)

    const responses = await db.select({
      blockId: funnelResponseEvents.blockId,
      branch: funnelResponseEvents.branch,
      total: sql<number>`count(*)::int`,
    }).from(funnelResponseEvents)
      .innerJoin(funnelExecutions, eq(funnelExecutions.id, funnelResponseEvents.executionId))
      .where(eq(funnelExecutions.funnelId, id))
      .groupBy(funnelResponseEvents.blockId, funnelResponseEvents.branch)

    const responsesByBlock: Record<string, { yes: number; no: number }> = {}
    for (const r of responses) {
      if (!responsesByBlock[r.blockId]) responsesByBlock[r.blockId] = { yes: 0, no: 0 }
      if (r.branch === 'yes') responsesByBlock[r.blockId].yes = r.total
      if (r.branch === 'no') responsesByBlock[r.blockId].no = r.total
    }

    return Response.json({
      data: {
        clicks: clicks.map(c => ({ block_id: c.blockId, total: c.total, clicados: c.clicados, taxa: c.total > 0 ? c.clicados / c.total : 0 })),
        responses: Object.entries(responsesByBlock).map(([blockId, v]) => ({
          block_id: blockId,
          sim: v.yes,
          nao: v.no,
          taxa_resposta: (v.yes + v.no) > 0 ? v.yes / (v.yes + v.no) : 0,
        })),
      },
    })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
