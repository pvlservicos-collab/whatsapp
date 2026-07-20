import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`
  select created_at, source, direction, phone, content, status
  from integration_message_logs
  where phone ilike '%1992443726%'
  order by created_at desc
  limit 10
`)
console.log('Logs para 1992443726:', rows.length)
for (const r of rows) console.log(r.created_at, r.source, r.direction, r.phone, '|', (r.content||'').slice(0,60), '|', r.status)

// Geral - quantos logs inbound chegaram nas ultimas horas, agrupado por hora
const { rows: hourly } = await pool.query(`
  select date_trunc('hour', created_at) as hora, direction, count(*) as total
  from integration_message_logs
  where created_at > now() - interval '8 hours'
  group by 1,2 order by 1 desc
`)
for (const r of hourly) console.log(r.hora, r.direction, r.total)

await pool.end()
