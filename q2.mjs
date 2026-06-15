import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Leads cuja PRIMEIRA atividade é a mensagem "Figurinha pronta" do funil (sem nada antes)
const { rows } = await pool.query(`
  with first_activity as (
    select lead_id, min(created_at) as first_at
    from lead_activities
    group by lead_id
  )
  select l.id, l.title, l.phone, la.content, la.metadata->>'source' as source, la.metadata->>'funnel_id' as funnel_id, la.created_at
  from lead_activities la
  join first_activity fa on fa.lead_id = la.lead_id and fa.first_at = la.created_at
  join leads l on l.id = la.lead_id
  where la.content ilike '%Figurinha pronta%'
  order by la.created_at desc
  limit 20
`)
console.log('Total leads cuja 1a msg é Figurinha pronta:', rows.length)
for (const r of rows) {
  console.log(r.created_at, r.title, '|', r.source, '|', r.funnel_id)
}

// Quantos leads tem "Figurinha liberada" em algum momento
const { rows: lib } = await pool.query(`
  select count(distinct lead_id) as total from lead_activities where content ilike '%Figurinha liberada%'
`)
console.log('Leads que receberam "Figurinha liberada" alguma vez:', lib[0].total)

await pool.end()
