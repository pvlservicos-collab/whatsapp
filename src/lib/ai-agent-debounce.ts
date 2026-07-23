/**
 * Debounce em memória para o agente de IA — o app roda em processo único
 * persistente (PM2 fork mode), não serverless, então um Map local resolve
 * sem precisar de Redis/fila externa. Se um dia o PM2 rodar em modo cluster
 * (múltiplas instâncias), isso precisa migrar pra um store compartilhado.
 *
 * Risco aceito: se o processo reiniciar durante a janela de debounce, o
 * buffer daquele lead se perde (a mensagem em si já está salva em
 * lead_activities — só a resposta automática daquela rajada não dispara).
 */

type PendingTurn = {
  activityIds: string[]
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingTurn>()

export function enqueueDebounced(
  leadId: string,
  activityId: string,
  windowSeconds: number,
  onFlush: (leadId: string, activityIds: string[]) => void
) {
  const existing = pending.get(leadId)
  if (existing) {
    clearTimeout(existing.timer)
    existing.activityIds.push(activityId)
    existing.timer = setTimeout(() => flush(leadId, onFlush), windowSeconds * 1000)
    return
  }

  const entry: PendingTurn = {
    activityIds: [activityId],
    timer: setTimeout(() => flush(leadId, onFlush), windowSeconds * 1000),
  }
  pending.set(leadId, entry)
}

function flush(leadId: string, onFlush: (leadId: string, activityIds: string[]) => void) {
  const entry = pending.get(leadId)
  if (!entry) return
  pending.delete(leadId)
  onFlush(leadId, entry.activityIds)
}

/** Cancela um turno pendente sem processá-lo — usado pelo comando /reset de teste. */
export function clearDebounced(leadId: string) {
  const existing = pending.get(leadId)
  if (existing) {
    clearTimeout(existing.timer)
    pending.delete(leadId)
  }
}
