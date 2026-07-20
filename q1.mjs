import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows: leadsRows } = await pool.query(`
  select id, title, phone from leads where phone like '%51992443726%' or phone like '%51992443726'
`)
console.log('Leads:', leadsRows)

for (const lead of leadsRows) {
  const { rows: acts } = await pool.query(`
    select id, type, content, metadata->>'direction' as direction, metadata->>'source' as source, metadata->>'block_id' as block_id, metadata->>'funnel_id' as funnel_id, created_at
    from lead_activities
    where lead_id = $1
    order by created_at asc
    limit 30
  `, [lead.id])
  console.log('--- Lead', lead.id, lead.title)
  for (const a of acts) {
    console.log(a.created_at, a.direction, a.type, '|', a.source, a.block_id, '|', (a.content || '').slice(0, 60))
  }
}
await pool.end()
