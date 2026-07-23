import { db } from '@/lib/db'
import {
  integrations, leads, leadActivities, funnelExecutions, aiAgentRuns,
} from '@/lib/schema'
import { eq, and, isNull, inArray, sql, desc } from 'drizzle-orm'
import { enqueueDebounced, clearDebounced } from '@/lib/ai-agent-debounce'
import { generateText, stepCountIs, type ModelMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { buildAgentTools } from '@/lib/ai-agent-tools'
import { sendLeadMessage } from '@/lib/messages'

const MODEL = 'gemini-3.6-flash'
const DEFAULT_HISTORY_LIMIT = 30
const DEFAULT_MAX_CHUNKS = 4

const DEFAULT_DEBOUNCE_SECONDS = 30
const RESET_COMMAND = '/reset'

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

/**
 * Fast path — chamado direto do webhook logo após o insert/update/publish do
 * inbound já existente. Precisa ficar bem abaixo de 1s: só checa opt-in +
 * escopo de teste e empilha no debounce, nunca chama o modelo aqui.
 */
export async function maybeEnqueueAgentTurn(params: {
  orgId: string
  leadId: string
  phone: string
  activityId: string
  content?: string
}) {
  const [integration] = await db
    .select({ id: integrations.id, config: integrations.config })
    .from(integrations)
    .where(and(
      eq(integrations.organizationId, params.orgId),
      eq(integrations.type, 'ai_agent'),
      eq(integrations.status, 'active'),
    ))
    .limit(1)

  if (!integration) return // org não optou pelo agente

  const config = (integration.config || {}) as {
    test_mode_phone?: string
    debounce_window_seconds?: number
  }

  // Degrau de segurança do piloto: se test_mode_phone estiver setado, o agente
  // só responde a esse número especifico, mesmo com a integração "ativa" —
  // ver Fase 8 do plano. Remover/limpar esse campo depois de validar o piloto.
  if (config.test_mode_phone) {
    if (normalizePhone(params.phone) !== normalizePhone(config.test_mode_phone)) return
  }

  // Comando de teste: reinicia a "sessão" que o agente enxerga sem apagar
  // nada de verdade — só marca um novo ponto de corte pro histórico. Só
  // chega até aqui quem já passou pelo escopo de teste acima.
  if (params.content?.trim().toLowerCase() === RESET_COMMAND) {
    await resetSession(params.orgId, params.leadId)
    return
  }

  const windowSeconds = config.debounce_window_seconds || DEFAULT_DEBOUNCE_SECONDS

  enqueueDebounced(params.leadId, params.activityId, windowSeconds, (leadId, activityIds) => {
    runAgentTurn({ orgId: params.orgId, leadId, triggerActivityIds: activityIds }).catch(err => {
      console.error('[ai-agent] runAgentTurn falhou:', err)
    })
  })
}

/**
 * Comando de teste "/reset": marca um novo ponto de corte no histórico que o
 * agente considera (leads.customAttributes.ai_session_started_at) e reseta o
 * estágio do funil — SEM apagar nenhuma mensagem real. A partir daí, o
 * histórico que o modelo vê só inclui atividades depois desse marcador.
 */
async function resetSession(orgId: string, leadId: string) {
  clearDebounced(leadId)

  const [lead] = await db.select({ customAttributes: leads.customAttributes }).from(leads).where(eq(leads.id, leadId)).limit(1)
  const current = (lead?.customAttributes || {}) as Record<string, any>
  const { ai_funnel_stage, ai_sent_media_shortcuts, ...rest } = current

  await db.update(leads).set({
    customAttributes: { ...rest, ai_session_started_at: new Date().toISOString() },
  }).where(eq(leads.id, leadId))

  await sendLeadMessage({
    organizationId: orgId,
    leadId,
    content: '🔄 Sessão de teste reiniciada — pode mandar a próxima mensagem como se fosse a primeira conversa.',
    type: 'whatsapp',
    source: 'ai_agent',
    direction: 'outbound',
  })
}

/**
 * Slow path — só chamado pelo callback do debounce (mesmo processo, sem
 * endpoint HTTP). Guards primeiro (funil ativo, humano já respondeu), depois
 * a chamada real ao modelo — ainda não implementada, ver TODO abaixo.
 */
export async function runAgentTurn(params: {
  orgId: string
  leadId: string
  triggerActivityIds: string[]
}) {
  const { orgId, leadId, triggerActivityIds } = params

  // Guard de funil: se há execução ativa, o agente cede — cobre de graça o
  // caso especial da figurinha também, sem tocar em figurinha.ts.
  const [activeFunnel] = await db
    .select({ id: funnelExecutions.id })
    .from(funnelExecutions)
    .where(and(
      eq(funnelExecutions.leadId, leadId),
      inArray(funnelExecutions.status, ['running', 'waiting', 'waiting_condition']),
    ))
    .limit(1)

  if (activeFunnel) {
    await logRun(orgId, leadId, triggerActivityIds, 'skipped_funnel_active')
    return
  }

  // Guard de handoff: humano respondeu manualmente (inclusive durante a
  // janela de debounce) → agente fica em silêncio.
  const [firstTrigger] = await db
    .select({ createdAt: leadActivities.createdAt })
    .from(leadActivities)
    .where(inArray(leadActivities.id, triggerActivityIds))
    .orderBy(leadActivities.createdAt)
    .limit(1)

  if (firstTrigger?.createdAt) {
    const [humanReply] = await db
      .select({ id: leadActivities.id })
      .from(leadActivities)
      .where(and(
        eq(leadActivities.leadId, leadId),
        sql`${leadActivities.metadata}->>'source' = 'human'`,
        sql`${leadActivities.createdAt} >= ${firstTrigger.createdAt.toISOString()}`,
      ))
      .limit(1)

    if (humanReply) {
      await logRun(orgId, leadId, triggerActivityIds, 'skipped_human_active')
      return
    }
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn(`[ai-agent] GOOGLE_GENERATIVE_AI_API_KEY não configurada — turno do lead ${leadId} não processado.`)
    await logRun(orgId, leadId, triggerActivityIds, 'error', 'GOOGLE_GENERATIVE_AI_API_KEY não configurada')
    return
  }

  const [integration] = await db.select({ config: integrations.config })
    .from(integrations)
    .where(and(eq(integrations.organizationId, orgId), eq(integrations.type, 'ai_agent')))
    .limit(1)
  const config = (integration?.config || {}) as {
    system_prompt?: string
    max_reply_chunks?: number
    history_limit?: number
  }

  const [lead] = await db.select({ title: leads.title, phone: leads.phone, customAttributes: leads.customAttributes })
    .from(leads).where(eq(leads.id, leadId)).limit(1)
  if (!lead) return

  const stage = ((lead.customAttributes as any)?.ai_funnel_stage) || 'abertura'
  const sessionStartedAt = (lead.customAttributes as any)?.ai_session_started_at as string | undefined
  const historyLimit = config.history_limit || DEFAULT_HISTORY_LIMIT
  const maxChunks = config.max_reply_chunks || DEFAULT_MAX_CHUNKS

  // Memória: últimas N lead_activities tipo whatsapp — note/system ficam de fora
  // do que o modelo vê (evita vazar comentário interno pra resposta da cliente).
  // Se o comando /reset já foi usado nesse lead, só considera atividades depois
  // do marcador — sem isso, um lead de teste com histórico antigo (ou até um
  // cliente real reaproveitado pra teste) nunca começa "do zero" de verdade.
  const historyRows = await db.select({
    content: leadActivities.content,
    metadata: leadActivities.metadata,
    createdAt: leadActivities.createdAt,
  })
    .from(leadActivities)
    .where(and(
      eq(leadActivities.leadId, leadId),
      eq(leadActivities.type, 'whatsapp'),
      sessionStartedAt ? sql`${leadActivities.createdAt} >= ${sessionStartedAt}` : sql`true`,
    ))
    .orderBy(desc(leadActivities.createdAt))
    .limit(historyLimit)

  const messages: ModelMessage[] = historyRows.reverse().map(r => {
    const direction = (r.metadata as any)?.direction
    const role = direction === 'inbound' ? 'user' : 'assistant'
    return { role, content: r.content || '' } as ModelMessage
  })

  const nowManaus = new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', hour12: false })
  const hourManaus = parseInt(nowManaus, 10)
  const saudacao = hourManaus < 12 ? 'Bom dia' : hourManaus < 18 ? 'Boa tarde' : 'Boa noite'

  const systemPrompt = `${config.system_prompt || ''}

# Contexto desta conversa
Estágio atual do funil (ai_funnel_stage): ${stage}
Nome da cliente (se já souber): ${lead.title || 'ainda não informado'}
Horário atual em Manaus: ${hourManaus}h — se essa for a primeira mensagem da
conversa, a saudação certa agora é "${saudacao}".`

  const pendingMedia: { mediaUrl: string | null; mediaType: string | null; content: string; delaySeconds: number }[] = []

  let result
  try {
    result = await generateText({
      model: google(MODEL),
      system: systemPrompt,
      messages,
      tools: buildAgentTools({ organizationId: orgId, leadId, phone: lead.phone || '', pendingMedia }),
      stopWhen: stepCountIs(6),
    })
  } catch (err: any) {
    console.error('[ai-agent] generateText falhou:', err)
    await logRun(orgId, leadId, triggerActivityIds, 'error', err.message)
    return
  }

  // Ponto de referência pra "humano respondeu DEPOIS disso" — sem isso, um lead
  // com qualquer histórico de mensagem humana antiga (ex: conversa de meses atrás)
  // trava o envio pra sempre, mesmo sem handoff real acontecendo agora. Bug real
  // encontrado no primeiro teste em produção (22/07): run logou "completed" com
  // reply_chunk_count > 0 mas nenhuma mensagem foi enviada de fato.
  const sinceRef = firstTrigger?.createdAt?.toISOString() || new Date().toISOString()

  async function humanRepliedSince() {
    const [humanReply] = await db.select({ id: leadActivities.id }).from(leadActivities)
      .where(and(
        eq(leadActivities.leadId, leadId),
        sql`${leadActivities.metadata}->>'source' = 'human'`,
        sql`${leadActivities.createdAt} >= ${sinceRef}`,
      ))
      .orderBy(desc(leadActivities.createdAt)).limit(1)
    return !!humanReply
  }

  const finalText = (result.text || '').trim()
  let actuallySent = 0
  if (finalText) {
    // Envio picotado: cada parágrafo (uma linha, quebra de linha simples) vira
    // uma mensagem separada — é como o modelo realmente escreve na prática (não
    // dependemos de um delimitador especial tipo "|||", que na prática o modelo
    // não seguia). Revalida o guard de handoff entre cada bolha — se um humano
    // responder no meio do envio, para o resto.
    const chunks = finalText.split('\n').map(c => c.trim()).filter(Boolean)

    for (const chunk of chunks.slice(0, maxChunks)) {
      if (await humanRepliedSince()) break

      await sendLeadMessage({
        organizationId: orgId,
        leadId,
        content: chunk,
        type: 'whatsapp',
        source: 'ai_agent',
        direction: 'outbound',
      })
      actuallySent++
      await new Promise(r => setTimeout(r, Math.min(chunk.length * 30, 3000)))
    }
  }

  // Mídia (search_media) só é enviada AQUI, depois de todo o texto final — nunca
  // dentro da própria ferramenta. Se mandássemos na hora da chamada da ferramenta,
  // a mídia sempre chegaria antes de qualquer texto (a etapa de ferramentas roda
  // antes do texto final ser montado), mesmo quando o prompt manda se apresentar
  // em texto primeiro. Visto em produção (22/07): áudio chegando sem nenhuma
  // introdução antes, "sem nexo" pra quem recebe.
  //
  // Cada passo respeita o delaySeconds configurado na resposta rápida (mesmo padrão
  // de sendPosVendaMessage em leadAutomations.ts) — sem isso, uma sequência pensada
  // com pausas (áudio, fotos uma a uma, comentário) chega tudo de uma vez, "em
  // rajada". Visto em produção (23/07): 1 áudio + 4 fotos sem pausa nenhuma entre
  // elas, porque a pausa configurada era descartada junto com o texto dos passos.
  for (let i = 0; i < pendingMedia.length; i++) {
    if (await humanRepliedSince()) break
    const item = pendingMedia[i]

    await sendLeadMessage({
      organizationId: orgId,
      leadId,
      content: item.content,
      type: 'whatsapp',
      source: 'ai_agent',
      direction: 'outbound',
      ...(item.mediaUrl ? { mediaUrl: item.mediaUrl, mediaType: item.mediaType || undefined } : {}),
    })
    actuallySent++

    if (i < pendingMedia.length - 1 && item.delaySeconds > 0) {
      await new Promise(r => setTimeout(r, item.delaySeconds * 1000))
    }
  }

  await logRun(orgId, leadId, triggerActivityIds, 'completed', undefined, MODEL, result.steps?.reduce((n, s) => n + (s.toolCalls?.length || 0), 0), actuallySent)
}

async function logRun(
  orgId: string,
  leadId: string,
  triggerActivityIds: string[],
  status: 'completed' | 'skipped_human_active' | 'skipped_funnel_active' | 'skipped_disabled' | 'skipped_out_of_scope' | 'error',
  errorMessage?: string,
  model?: string,
  toolCallCount?: number,
  replyChunkCount?: number,
) {
  await db.insert(aiAgentRuns).values({
    organizationId: orgId,
    leadId,
    triggerActivityIds,
    status,
    errorMessage,
    model,
    replyChunkCount: replyChunkCount ?? 0,
    escalated: false,
    toolCalls: toolCallCount ? [{ count: toolCallCount }] : [],
  })
}
