import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { pipelineStages } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

type Params = { params: Promise<{ stage_id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateRequest(req)
    const { stage_id } = await params
    const body = await req.json()
    const updates: any = {}
    if (body.name) updates.name = body.name
    if (body.color !== undefined) updates.color = body.color
    if (body.rank !== undefined) updates.rank = body.rank
    if (body.target_volume !== undefined) updates.targetVolume = body.target_volume
    if (!Object.keys(updates).length) return apiError(400, 'Nada para atualizar.')
    const [updated] = await db.update(pipelineStages).set({ ...updates, updatedAt: new Date() })
      .where(and(eq(pipelineStages.id, stage_id), eq(pipelineStages.organizationId, auth.organizationId)))
      .returning()
    return Response.json({ data: updated })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateRequest(req)
    const { stage_id } = await params
    await db.update(pipelineStages).set({ deletedAt: new Date() })
      .where(and(eq(pipelineStages.id, stage_id), eq(pipelineStages.organizationId, auth.organizationId)))
    return Response.json({ success: true })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
