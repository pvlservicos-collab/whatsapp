/**
 * Neon Database Client
 * Substitui: @supabase/supabase-js (lado servidor)
 *
 * Uso: import { db } from '@/lib/db'
 * Exemplo: const leads = await db.select().from(schema.leads).where(...)
 */
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Em Edge Runtime, usa WebSocket da Cloudflare
neonConfig.fetchConnectionCache = true

const databaseUrl = process.env.DATABASE_URL || process.env.whatsapp_DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida nas variáveis de ambiente')
}

const sql = neon(databaseUrl)
export const db = drizzle(sql, { schema })

// Exporta também o cliente sql puro para queries raw quando necessário
export { sql as rawSql }
export type DB = typeof db
