import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { messageFunnels, funnelBlocks, funnelExecutions, funnelResponseEvents, leadActivities } from '@/lib/schema'
import { eq, and, isNull, asc, sql } from 'drizzle-orm'

const CONDITION_LABELS: Record<string, string> = {
  clique_pagina: 'Visitou a página da figurinha em até 1h?',
  pagamento: 'Confirmou o pagamento em até 1h?',
  respondeu: 'Respondeu à mensagem?',
}

/**
 * GET /api/metrics/figurinha
 * Métricas por etapa do funil "Geração de Figurinha Whatsapp" (gatilho
 * geracaowhatsapp): quantos leads entraram e quantos receberam/responderam
 * cada etapa do fluxo.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)

    const [funnel] = await db.select({ id: messageFunnels.id, name: messageFunnels.name })
      .from(messageFunnels)
      .where(and(
        eq(messageFunnels.organizationId, auth.organizationId),
        eq(messageFunnels.trigger, 'geracaowhatsapp'),
        isNull(messageFunnels.deletedAt),
      ))
      .limit(1)
    if (!funnel) return apiError(404, 'Funil de geração de figurinha não encontrado.')

    const blocks = await db.select().from(funnelBlocks)
      .where(eq(funnelBlocks.funnelId, funnel.id))
      .orderBy(asc(funnelBlocks.createdAt))

    const [{ entradas }] = await db.select({
      entradas: sql<number>`count(distinct ${funnelExecutions.leadId})::int`,
    }).from(funnelExecutions).where(eq(funnelExecutions.funnelId, funnel.id))

    const messageCounts = await db.select({
      blockId: sql<string>`${leadActivities.metadata}->>'block_id'`,
      total: sql<number>`count(distinct ${leadActivities.leadId})::int`,
    }).from(leadActivities)
      .where(and(
        eq(leadActivities.organizationId, auth.organizationId),
        sql`${leadActivities.metadata}->>'funnel_id' = ${funnel.id}`,
        sql`${leadActivities.metadata}->>'send_status' = 'sent'`,
      ))
      .groupBy(sql`${leadActivities.metadata}->>'block_id'`)

    const responseCounts = await db.select({
      blockId: funnelResponseEvents.blockId,
      branch: funnelResponseEvents.branch,
      total: sql<number>`count(distinct ${funnelExecutions.leadId})::int`,
    }).from(funnelResponseEvents)
      .innerJoin(funnelExecutions, eq(funnelExecutions.id, funnelResponseEvents.executionId))
      .where(eq(funnelExecutions.funnelId, funnel.id))
      .groupBy(funnelResponseEvents.blockId, funnelResponseEvents.branch)

    const messageCountMap = new Map(messageCounts.map(m => [m.blockId, m.total]))
    const responseMap = new Map<string, { yes: number; no: number }>()
    for (const r of responseCounts) {
      const cur = responseMap.get(r.blockId) || { yes: 0, no: 0 }
      if (r.branch === 'yes') cur.yes = r.total
      if (r.branch === 'no') cur.no = r.total
      responseMap.set(r.blockId, cur)
    }

    const stages = blocks
      .filter(b => b.type === 'message' || b.type === 'condition')
      .map(b => {
        if (b.type === 'message') {
          const text = ((b.config as any)?.text || '').split('\n')[0]
          return {
            block_id: b.id,
            type: 'message' as const,
            label: text.slice(0, 80) || 'Mensagem',
            total: messageCountMap.get(b.id) || 0,
          }
        }
        const conditionType = (b.config as any)?.conditionType || 'respondeu'
        const r = responseMap.get(b.id) || { yes: 0, no: 0 }
        return {
          block_id: b.id,
          type: 'condition' as const,
          label: CONDITION_LABELS[conditionType] || 'Condição',
          sim: r.yes,
          nao: r.no,
        }
      })

    return Response.json({ data: { funnel_name: funnel.name, entradas, stages } })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
