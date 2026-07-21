import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

// drizzle-orm/node-postgres usa TCP direto (driver pg) — funciona com Neon Cloud
// (sslmode=require na DATABASE_URL) e com PostgreSQL local na VPS (sslmode=disable).
// O driver anterior @neondatabase/serverless usava HTTP e só funcionava com Neon Cloud,
// causando "TypeError: Failed to parse URL from https://api.0.0.1/sql" na VPS.

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
      || process.env.whatsapp_DATABASE_URL
      || process.env.whatsappnaturabelas_DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não definida nas variáveis de ambiente')
    // Sem connectionTimeoutMillis, pedidos de conexão acima do limite do pool ficavam
    // enfileirados pra sempre sem erro (driver `pg` não falha, só espera indefinidamente)
    // — isso fazia updates em tempo real "sumirem" silenciosamente com mais gente logada
    // ao mesmo tempo, sem nenhum erro visível. max:20 tem folga confortável contra os
    // 100 conexões reais do Postgres pra essa organização pequena.
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX) || 20,
      connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS) || 5000,
    })
    _db = drizzle(pool, { schema })
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    const instance = getDb() as any
    const value = instance[prop]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export type DB = typeof db
