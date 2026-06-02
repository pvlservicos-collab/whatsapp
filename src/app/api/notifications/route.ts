import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.memberId) return apiError(403, 'Necessário sessão de usuário.')
    const data = await db.select().from(notifications)
      .where(and(
        eq(notifications.organizationId, auth.organizationId),
        eq(notifications.recipientMemberId, auth.memberId),
        eq(notifications.isRead, false)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return Response.json({ data })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.memberId) return apiError(403, 'Necessário sessão de usuário.')
    const body = await req.json()
    if (body.markAllAsRead) {
      await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.organizationId, auth.organizationId), eq(notifications.recipientMemberId, auth.memberId)))
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await db.update(notifications).set({ isRead: true })
        .where(inArray(notifications.id, body.ids))
    }
    return Response.json({ success: true })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
