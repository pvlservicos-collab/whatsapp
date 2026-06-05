import { NextRequest } from 'next/server'
import { authenticateRequest, apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const data = await db.select({
      id: apiTokens.id,
      name: apiTokens.name,
      isActive: apiTokens.isActive,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    }).from(apiTokens)
      .where(and(eq(apiTokens.organizationId, auth.organizationId), eq(apiTokens.isActive, true)))
      .orderBy(desc(apiTokens.createdAt))
    return Response.json({ data })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.memberId) return apiError(403, 'Necessário sessão de usuário.')
    const body = await req.json()
    if (!body.token_hash || !body.name) return apiError(400, 'name e token_hash são obrigatórios.')
    const [token] = await db.insert(apiTokens).values({
      organizationId: auth.organizationId,
      name: body.name,
      tokenHash: body.token_hash,
    }).returning({ id: apiTokens.id, name: apiTokens.name, createdAt: apiTokens.createdAt })
    return Response.json({ data: token }, { status: 201 })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return apiError(400, 'id é obrigatório.')
    await db.update(apiTokens).set({ isActive: false })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.organizationId, auth.organizationId)))
    return Response.json({ success: true })
  } catch (err: any) { return apiError(err.status || 500, err.message || 'Erro interno.') }
}
