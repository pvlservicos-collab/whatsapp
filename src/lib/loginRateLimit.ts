/**
 * Rate limit de tentativas de login, em memória (processo único via PM2 — não precisa
 * de Redis/dependência nova). Sem isso, um atacante podia tentar senha ilimitadamente
 * contra qualquer email conhecido (achado da auditoria de segurança de 2026-07-20).
 */
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

const attempts = new Map<string, { count: number; resetAt: number }>()

export function isLoginLocked(email: string): boolean {
  const entry = attempts.get(email)
  if (!entry) return false
  if (Date.now() > entry.resetAt) {
    attempts.delete(email)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

export function recordLoginFailure(email: string): void {
  const now = Date.now()
  const entry = attempts.get(email)
  if (!entry || now > entry.resetAt) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count++
}

export function clearLoginAttempts(email: string): void {
  attempts.delete(email)
}
