import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { organizationMembers, profiles } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const data = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        organizationId: organizationMembers.organizationId,
        roleId: organizationMembers.roleId,
        status: organizationMembers.status,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(organizationMembers)
      .leftJoin(profiles, eq(profiles.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, auth.organizationId),
          isNull(organizationMembers.deletedAt)
        )
      )
    return Response.json({ data })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
