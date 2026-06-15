import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Logs de integração inbound com "figurinha" no conteudo
const { rows } = await pool.query(`
  select created_at, source, direction, phone, content, status, lead_id
  from integration_message_logs
  where content ilike '%figurinha%'
  order by created_at desc
  limit 20
`)
console.log('Total logs com "figurinha":', rows.length)
for (const r of rows) console.log(r.created_at, r.direction, r.phone, '|', (r.content||'').slice(0,50), '|', r.status)

// Total geral de logs inbound recentes (últimas 24h)
const { rows: c } = await pool.query(`
  select count(*) from integration_message_logs where direction='inbound' and created_at > now() - interval '24 hours'
`)
console.log('Total inbound 24h:', c[0].count)

await pool.end()
