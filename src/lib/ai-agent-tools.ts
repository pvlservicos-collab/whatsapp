import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { products, quickReplies, quickReplySteps, leads, leadActivities, integrations } from '@/lib/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'

type PendingMediaItem = { mediaUrl: string; mediaType: string; content: string }
type ToolCtx = { organizationId: string; leadId: string; phone: string; pendingMedia: PendingMediaItem[] }

/**
 * Ferramentas do agente de vendas. Duas categorias, nunca misturadas (ver plano):
 * - search_media: ENVIO — manda o arquivo real (áudio/foto/vídeo), nunca reescreve.
 * - search_product_info / search_company_info: RAG de fato — texto que o modelo
 *   lê e usa pra compor a própria resposta.
 * save_lead_info/advance_stage/escalate_to_human são ferramentas de estado, não
 * de conteúdo.
 */
export function buildAgentTools(ctx: ToolCtx) {
  return {
    search_media: tool({
      description: 'Busca e ENVIA um áudio/foto/vídeo real da biblioteca de prova social por tema/dor específica (ex: "conexao", "boas-vindas", "barriga", "ceticismo"). O arquivo é enviado diretamente pro WhatsApp da cliente — não descreva o conteúdo em texto, o próprio arquivo é a resposta.',
      inputSchema: z.object({
        tema: z.string().describe('Tema/dor específica buscada, ex: "conexao", "barriga", "ceticismo"'),
        tipo: z.enum(['audio', 'image', 'video']).optional(),
      }),
      execute: async ({ tema, tipo }) => {
        const rows = await db.select({
          id: quickReplies.id, shortcut: quickReplies.shortcut,
          mediaUrl: quickReplies.mediaUrl, mediaType: quickReplies.mediaType,
        })
          .from(quickReplies)
          .where(and(
            eq(quickReplies.organizationId, ctx.organizationId),
            isNull(quickReplies.deletedAt),
            sql`${quickReplies.tags} && ARRAY[${tema}]::text[]`,
            tipo ? eq(quickReplies.mediaType, tipo) : sql`true`,
          ))
          .limit(1)

        if (rows.length === 0) return { sent: false, reason: `Nenhuma mídia encontrada pro tema "${tema}".` }

        const qr = rows[0]
        const steps = await db.select().from(quickReplySteps)
          .where(eq(quickReplySteps.quickReplyId, qr.id))
          .orderBy(quickReplySteps.position)

        const itemsToSend = steps.length > 0
          ? steps.filter(s => s.mediaUrl).map(s => ({ mediaUrl: s.mediaUrl!, mediaType: s.mediaType || 'image', content: s.content || '' }))
          : (qr.mediaUrl ? [{ mediaUrl: qr.mediaUrl, mediaType: qr.mediaType || 'image', content: '' }] : [])

        // Não envia aqui — só reserva. Se mandássemos na hora, a mídia sempre chegaria
        // antes do texto final (que só é montado depois que todas as ferramentas
        // terminam), mesmo quando o prompt manda se apresentar em texto primeiro.
        // runAgentTurn manda o texto final e só depois esvazia essa fila, nessa ordem.
        ctx.pendingMedia.push(...itemsToSend)

        return { sent: true, shortcut: qr.shortcut, items: itemsToSend.length }
      },
    }),

    search_product_info: tool({
      description: 'Consulta composição, modo de uso, contraindicações e preços vigentes do produto. Use o resultado pra ESCREVER sua própria resposta, nunca copie literalmente.',
      inputSchema: z.object({ pergunta: z.string() }),
      execute: async () => {
        const rows = await db.select({ name: products.name, description: products.description, price: products.price })
          .from(products)
          .where(and(eq(products.organizationId, ctx.organizationId), eq(products.status, 'active')))
        return { products: rows }
      },
    }),

    search_company_info: tool({
      description: 'Consulta informações da marca (forma de pagamento, CNPJ/Pix, áreas de entrega, horário, políticas). Use pra ESCREVER sua própria resposta, nunca copie literalmente.',
      inputSchema: z.object({ pergunta: z.string() }),
      execute: async () => {
        const [integ] = await db.select({ config: integrations.config }).from(integrations)
          .where(and(eq(integrations.organizationId, ctx.organizationId), eq(integrations.type, 'ai_agent')))
          .limit(1)
        const config = (integ?.config || {}) as { company_info?: string }
        return { company_info: config.company_info || 'Informação não cadastrada ainda.' }
      },
    }),

    save_lead_info: tool({
      description: 'Salva informações descobertas na qualificação (kg desejado, há quanto tempo, o que já tentou, restrição de saúde). Chame sempre que souber algo novo relevante.',
      inputSchema: z.object({
        campos: z.record(z.string(), z.any()).describe('Objeto livre com os campos descobertos, ex: {"kg_desejado": 10, "ha_quanto_tempo": "2 anos"}'),
      }),
      execute: async ({ campos }) => {
        const [lead] = await db.select({ customAttributes: leads.customAttributes }).from(leads).where(eq(leads.id, ctx.leadId)).limit(1)
        const current = (lead?.customAttributes || {}) as Record<string, any>
        await db.update(leads).set({ customAttributes: { ...current, ...campos } }).where(eq(leads.id, ctx.leadId))
        return { saved: true }
      },
    }),

    advance_stage: tool({
      description: 'Atualiza o estágio do funil da conversa (abertura, conexao, qualificacao, agitacao, apresentacao, preco, objecao, checkout, confirmado, upsell, posvenda). Chame sempre que a conversa avançar de fase — libera o envio de mídia pesada (bloqueada em "abertura").',
      inputSchema: z.object({ estagio: z.string() }),
      execute: async ({ estagio }) => {
        const [lead] = await db.select({ customAttributes: leads.customAttributes }).from(leads).where(eq(leads.id, ctx.leadId)).limit(1)
        const current = (lead?.customAttributes || {}) as Record<string, any>
        await db.update(leads).set({ customAttributes: { ...current, ai_funnel_stage: estagio } }).where(eq(leads.id, ctx.leadId))
        return { stage: estagio }
      },
    }),

    escalate_to_human: tool({
      description: 'Aciona quando: pedido de atendimento presencial, reclamação/insatisfação, problema de pagamento que você não resolve, dúvida médica além do que a base cobre, ou pedido explícito de falar com humano/Geicymara. Depois disso você fica em silêncio nessa conversa até um humano responder.',
      inputSchema: z.object({ motivo: z.string() }),
      execute: async ({ motivo }) => {
        await db.insert(leadActivities).values({
          organizationId: ctx.organizationId,
          leadId: ctx.leadId,
          type: 'note',
          content: `[Agente IA] Escalado pra humano: ${motivo}`,
          metadata: { source: 'ai_agent', escalated: true },
        })
        return { escalated: true }
      },
    }),
  }
}
