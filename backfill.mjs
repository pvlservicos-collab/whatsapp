import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const ORG = 'bdfac9ab-68cd-4434-856c-897199dc267d'

// Acha o funil de geração de figurinha via whatsapp
const { rows: funnels } = await pool.query(`
  select id, name from message_funnels
  where organization_id = $1 and trigger = 'geracaowhatsapp' and deleted_at is null
`, [ORG])
console.log('Funil:', funnels)

const funnelId = funnels[0].id

// Garante a tag "figurinha"
let { rows: tagRows } = await pool.query(`
  select id from tags where organization_id = $1 and name ilike 'figurinha' limit 1
`, [ORG])

let tagId
if (tagRows.length === 0) {
  const { rows } = await pool.query(`
    insert into tags (organization_id, name, color) values ($1, 'figurinha', '#a855f7') returning id
  `, [ORG])
  tagId = rows[0].id
  console.log('Tag criada:', tagId)
} else {
  tagId = tagRows[0].id
  console.log('Tag existente:', tagId)
}

// Aplica a tag a todos os leads com execução nesse funil
const { rows: result } = await pool.query(`
  insert into lead_tags (lead_id, tag_id, organization_id)
  select distinct fe.lead_id, $2::uuid, $1
  from funnel_executions fe
  where fe.funnel_id = $3
  on conflict do nothing
  returning lead_id
`, [ORG, tagId, funnelId])

console.log('Leads marcados com a tag figurinha:', result.length)

await pool.end()
