import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { organizationRoles } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const data = await db.select().from(organizationRoles)
      .where(eq(organizationRoles.organizationId, auth.organizationId))
      .orderBy(asc(organizationRoles.createdAt))
    return Response.json({ data })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
