import { processTick } from '@/lib/funnel-engine'

/**
 * POST /api/funnels/tick
 * Processa todas as execuções de funis pendentes (esperas vencidas e checagens
 * de "Respondeu?"). Sem autenticação (uso interno) — chamado periodicamente por
 * um Schedule Trigger do n8n.
 */
export async function POST() {
  try {
    const result = await processTick()
    return Response.json({ status: 'ok', ...result })
  } catch (err: any) {
    return Response.json({ status: 'error', message: err.message || 'Erro interno.' }, { status: 500 })
  }
}
