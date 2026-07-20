/**
 * ARQUIVO LEGADO — mantido apenas para compatibilidade temporária
 * de hooks que ainda não foram totalmente migrados.
 *
 * TODO: remover este arquivo após migrar todos os hooks para fetch API.
 *
 * Qualquer chamada a supabase.from() aqui vai falhar silenciosamente
 * com uma exceção clara para facilitar o rastreamento.
 */
export const supabase = new Proxy({} as any, {
  get(_, prop) {
    if (prop === 'auth') {
      return {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => {},
        updateUser: async () => ({ error: new Error('[MIGRADO] Use /api/users/me PATCH') }),
      }
    }
    if (prop === 'storage') {
      return {
        from: () => ({
          upload: async () => { throw new Error('[MIGRADO] Use /api/upload') },
          getPublicUrl: () => { throw new Error('[MIGRADO] Use /api/upload') },
        }),
      }
    }
    if (prop === 'from') {
      return (table: string) => {
        throw new Error(
          `[MIGRAÇÃO PENDENTE] supabase.from('${table}') foi chamado. ` +
          `Use db (Drizzle/Neon) em API routes ou fetch('/api/...') em hooks client-side.`
        )
      }
    }
    if (prop === 'channel') {
      return () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}), bind: () => {} })
    }
    if (prop === 'removeChannel') return () => {}
    return undefined
  },
})
