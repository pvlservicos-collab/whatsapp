import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { leads, leadActivities, messageFunnels, pipelineStages } from '@/lib/schema'
import { eq, and, isNull, ilike, asc, desc, sql } from 'drizzle-orm'
import { startExecution } from '@/lib/funnel-engine'
import { ORGANIZATION_ID } from '@/lib/automated-message'
import { buildFigurinhaProntaMessage, sendFigurinhaAutoMessage } from '@/lib/figurinha'

/**
 * POST /api/webhooks/figurinha-gerada
 *
 * Webhook interno (sem autenticação) chamado por outro sistema quando uma
 * figurinha é gerada para um número de telefone. Envia ao lead correspondente
 * uma mensagem com o link da figurinha e dispara o gatilho de funil
 * "geracaowhatsapp" (se houver algum funil ativo configurado).
 *
 * Payload esperado:
 * {
 *   "telefone": "96991712831",   // DDD + número, sem +55
 *   "mensagem": "Figurinha gerada para o telefone 96991712831"
 * }
 *
 * Como o número avisado aqui é apenas um identificador que o usuário envia
 * de volta numa mensagem do WhatsApp (ex: "Quero minha figurinha Numero
 * #96991712831"), a prioridade é procurar uma mensagem recebida que contenha
 * esse número (ex: "#96991712831") para linkar com a conversa certa. Se não
 * encontrar, cai para o match direto pelo telefone do lead.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    let body: any = {}
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      return Response.json({ ok: false, error: 'JSON inválido.' }, { status: 200 })
    }

    if (Array.isArray(body)) body = body[0] || {}

    const telefoneRaw = body?.telefone ?? body?.phone ?? body?.celular ?? body?.whatsapp ?? null
    const telefone = telefoneRaw != null ? String(telefoneRaw).replace(/\D/g, '') : ''

    if (!telefone) {
      return Response.json({ ok: false, error: 'Campo "telefone" ausente ou inválido.' }, { status: 200 })
    }

    // 1. Prioridade: procura uma mensagem recebida contendo esse número
    // (ex: "Quero minha figurinha Numero #96991712831")
    const [match] = await db.select({ leadId: leadActivities.leadId })
      .from(leadActivities)
      .where(and(
        eq(leadActivities.organizationId, ORGANIZATION_ID),
        sql`${leadActivities.metadata}->>'direction' = 'inbound'`,
        ilike(leadActivities.content, `%${telefone}%`),
      ))
      .orderBy(desc(leadActivities.createdAt))
      .limit(1)

    let leadId = match?.leadId

    // 2. Se não achou, tenta achar o lead diretamente pelo telefone (caso seja o próprio número do WhatsApp)
    if (!leadId) {
      const [leadByPhone] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(
          eq(leads.organizationId, ORGANIZATION_ID),
          isNull(leads.deletedAt),
          ilike(leads.phone, `%${telefone}`),
        ))
        .limit(1)

      leadId = leadByPhone?.id
    }

    // 3. Ainda não encontrou: cria um lead novo pelo telefone informado
    if (!leadId) {
      const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
        .where(and(eq(pipelineStages.organizationId, ORGANIZATION_ID), isNull(pipelineStages.deletedAt)))
        .orderBy(asc(pipelineStages.rank)).limit(1)

      const phone = telefone.length <= 11 ? `55${telefone}` : telefone

      const [newLead] = await db.insert(leads).values({
        organizationId: ORGANIZATION_ID,
        title: phone,
        phone,
        stageId: firstStage?.id || null,
        lastActivityAt: new Date(),
        customAttributes: { source: 'geracaowhatsapp' },
      }).returning({ id: leads.id })

      leadId = newLead.id
    }

    // Envia a mensagem com o link da figurinha pronta
    const [lead] = await db.select({ id: leads.id, phone: leads.phone }).from(leads).where(eq(leads.id, leadId)).limit(1)

    if (lead?.phone) {
      const content = buildFigurinhaProntaMessage(telefone)
      await sendFigurinhaAutoMessage(lead.id, lead.phone, content, 'geracaowhatsapp')
    }

    // Dispara funis ativos com gatilho "geracaowhatsapp" (caso haja algum configurado)
    const funnels = await db.select({ id: messageFunnels.id }).from(messageFunnels)
      .where(and(
        eq(messageFunnels.organizationId, ORGANIZATION_ID),
        eq(messageFunnels.trigger, 'geracaowhatsapp'),
        eq(messageFunnels.isActive, true),
        isNull(messageFunnels.deletedAt),
      ))

    for (const funnel of funnels) {
      await startExecution(funnel.id, ORGANIZATION_ID, leadId)
    }

    return Response.json({ ok: true, leadId, funnelsTriggered: funnels.length })
  } catch (err: any) {
    console.error('[/api/webhooks/figurinha-gerada]', err)
    return Response.json({ ok: false, error: err.message || 'Erro interno.' }, { status: 200 })
  }
}
