import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`
  select la.lead_id, l.title, l.created_at as lead_created_at, la.content, la.created_at as msg_created_at
  from lead_activities la
  join leads l on l.id = la.lead_id
  where la.content ilike '%Quero minha figurinha%' and l.title != 'Pedro'
  order by la.created_at desc
  limit 15
`)
console.log('Total (sem Pedro):', rows.length)
for (const r of rows) {
  console.log('lead:', r.title, '| lead_created_at:', r.lead_created_at, '| msg_created_at:', r.msg_created_at)
}

// Conta total geral
const { rows: total } = await pool.query(`select count(*) as c from lead_activities where content ilike '%Quero minha figurinha%'`)
console.log('Total geral com "Quero minha figurinha":', total[0].c)

await pool.end()
