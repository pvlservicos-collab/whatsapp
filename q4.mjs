import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`
  select la.created_at, l.title, la.content, la.metadata->>'direction' as direction
  from lead_activities la
  join leads l on l.id = la.lead_id
  where la.metadata->>'direction' = 'inbound'
  order by la.created_at desc
  limit 15
`)
for (const r of rows) {
  console.log(r.created_at, r.title, '|', (r.content||'').slice(0,60))
}
await pool.end()
