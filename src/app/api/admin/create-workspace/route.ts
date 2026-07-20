import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { organizations, organizationRoles, setupTokens, tiers } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!(session?.user as any)?.isSuperadmin) return apiError(403, 'Somente super admins podem criar workspaces.')

    const body = await req.json()
    if (!body.name) return apiError(400, 'Campo obrigatório: name')

    const [tier] = await db.select().from(tiers).where(eq(tiers.name, body.tier || 'free')).limit(1)

    const [org] = await db.insert(organizations).values({
      name: body.name,
      tierId: tier?.id || null,
      timezone: body.timezone || 'America/Sao_Paulo',
    }).returning()

    // Criar roles padrão
    await db.insert(organizationRoles).values([
      { organizationId: org.id, name: 'Admin', permissions: { '*': true } },
      { organizationId: org.id, name: 'Agente', permissions: { leads: { view: true, edit: true }, chat: { view: true, send: true } } },
    ])

    // Criar setup token (expira em 24h)
    const token = randomBytes(32).toString('hex')
    const [setupToken] = await db.insert(setupTokens).values({
      organizationId: org.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning()

    return Response.json({ organization: org, setup_token: token }, { status: 201 })
  } catch (err: any) {
    return apiError(500, err.message || 'Erro interno.')
  }
}
