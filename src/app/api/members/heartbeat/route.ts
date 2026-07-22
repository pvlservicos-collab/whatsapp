import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { organizationMembers } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.memberId) return apiError(400, 'Requisição sem membro associado.')

    await db.update(organizationMembers).set({ lastActiveAt: new Date() }).where(eq(organizationMembers.id, auth.memberId))

    return Response.json({ ok: true })
  } catch (err: any) {
    return apiError(err.status || 500, err.message || 'Erro interno.')
  }
}
