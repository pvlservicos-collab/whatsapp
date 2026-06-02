import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { tags } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const data = await db.select().from(tags)
      .where(eq(tags.organizationId, auth.organizationId))
      .orderBy(asc(tags.name))
    return Response.json({ data })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const body = await req.json()
    const missing = validateRequired(body, ['name', 'source'])
    if (missing) return apiError(400, missing)
    const [tag] = await db.insert(tags).values({
      organizationId: auth.organizationId,
      name: body.name,
      color: body.color || '#6366f1',
    }).returning()
    return Response.json({ data: tag }, { status: 201 })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
