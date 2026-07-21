import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL || process.env.whatsapp_DATABASE_URL || process.env.whatsappnaturabelas_DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não definida nas variáveis de ambiente')
    // max era 10 sem connectionTimeoutMillis: acima do limite, pedidos de conexão
    // ficavam enfileirados pra sempre sem erro (driver `pg`, sem timeout configurado
    // não falha, só espera indefinidamente) — isso que fazia updates em tempo real
    // "sumirem" silenciosamente com mais gente logada ao mesmo tempo, sem nenhum
    // erro visível. max:20 tem folga confortável contra os 100 conexões reais do
    // Postgres pra essa organização pequena; o timeout converte o travamento
    // silencioso em erro capturável em poucos segundos.
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
