import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Mensagens inbound "Quero minha figurinha Nº#..." mais recentes
const { rows } = await pool.query(`
  select la.id, la.lead_id, l.title, l.created_at as lead_created_at, la.content, la.created_at as msg_created_at
  from lead_activities la
  join leads l on l.id = la.lead_id
  where la.content ilike '%Quero minha figurinha%'
  order by la.created_at desc
  limit 10
`)
for (const r of rows) {
  console.log('lead:', r.title, '| lead_created_at:', r.lead_created_at, '| msg_created_at:', r.msg_created_at, '| content:', r.content)
}

await pool.end()
