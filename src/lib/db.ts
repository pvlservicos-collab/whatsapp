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
    const pool = new Pool({ connectionString: url })
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
