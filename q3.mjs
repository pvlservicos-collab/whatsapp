import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Procura qualquer mensagem inbound (em qualquer lead) contendo parte do numero
const { rows } = await pool.query(`
  select la.lead_id, l.title, l.phone, la.content, la.created_at, la.metadata->>'direction' as direction
  from lead_activities la
  join leads l on l.id = la.lead_id
  where la.content ilike '%1992443726%'
  order by la.created_at asc
`)
for (const r of rows) {
  console.log(r.created_at, r.lead_id, r.title, '|', r.direction, '|', (r.content||'').slice(0,80))
}

// telefone do funnel_execution context pra esse lead
const { rows: exec } = await pool.query(`
  select fe.id, fe.context, fe.status, fe.started_at, fb.config->>'trigger' as trigger
  from funnel_executions fe
  join funnel_blocks fb on fb.id = fe.current_block_id
  where fe.lead_id = '1a8b0f5a-e7a9-4752-b61e-2ccf5e9c98f3'
`)
console.log('Execucoes:', JSON.stringify(exec, null, 2))

await pool.end()
