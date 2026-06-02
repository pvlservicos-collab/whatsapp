/**
 * Autenticação de requisições API
 * Substitui: authenticateRequest usando Supabase JWT
 *
 * Suporta dois modos:
 * 1. API Token (prefixo atl_) — hash SHA-256 comparado na tabela api_tokens
 * 2. NextAuth JWT — decodificado via jose usando AUTH_SECRET
 */
import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { eq, and } from 'drizzle-orm'
import { db } from './db'
import { apiTokens, organizationMembers, profiles } from './schema'

interface AuthResult {
  organizationId: string
  memberId: string | null
  userId: string | null
  roleId: string | null
  isSuperAdmin?: boolean
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Token de autenticação não fornecido. Use Authorization: Bearer <token>' }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw { status: 401, message: 'Token vazio.' }

  // ── API Token (atl_*) ────────────────────────────────────────────────────
  if (token.startsWith('atl_')) {
    const tokenHash = await hashToken(token)

    const [apiToken] = await db
      .select({ organizationId: apiTokens.organizationId })
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.isActive, true)))
      .limit(1)

    if (!apiToken) throw { status: 401, message: 'Token de API inválido ou revogado.' }

    // Atualiza last_used_at de forma assíncrona (não bloqueia)
    db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.tokenHash, tokenHash))
      .catch(console.error)

    return { organizationId: apiToken.organizationId, memberId: null, userId: null, roleId: null }
  }

  // ── NextAuth JWT ─────────────────────────────────────────────────────────
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const userId = payload.id as string
    if (!userId) throw new Error('JWT sem user id')

    const [member] = await db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        roleId: organizationMembers.roleId,
        isSuperadmin: profiles.isSuperadmin,
      })
      .from(organizationMembers)
      .leftJoin(profiles, eq(profiles.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1)

    if (!member) throw { status: 403, message: 'Usuário não associado a nenhuma organização ativa.' }

    return {
      organizationId: member.organizationId,
      memberId: member.id,
      userId,
      roleId: member.roleId,
      isSuperAdmin: member.isSuperadmin || false,
    }
  } catch (err: any) {
    if (err.status) throw err
    throw { status: 401, message: 'JWT inválido ou expirado.' }
  }
}

export function apiError(status: number, message: string) {
  return Response.json({ error: message }, { status })
}

export function validateRequired(body: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Campo obrigatório ausente: ${field}`
    }
  }
  return null
}

export function validateSource(source: string): string | null {
  if (!source || typeof source !== 'string' || source.trim() === '') {
    return `Valor inválido para source: "${source}". Deve ser uma string não vazia.`
  }
  return null
}
