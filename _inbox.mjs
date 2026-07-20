import { Pool } from '@neondatabase/serverless'
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_YoV9qFaEuw8K@ep-tiny-dawn-ace0au8b-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' })

const { rows } = await pool.query(`
  SELECT la.content, la.metadata->>'direction' as dir, la.created_at, l.phone, l.title
  FROM lead_activities la
  JOIN leads l ON l.id = la.lead_id
  WHERE la.type = 'whatsapp'
  ORDER BY la.created_at DESC
  LIMIT 5
`)

const now = Date.now()
for (const r of rows) {
  const ago = Math.round((now - new Date(r.created_at).getTime()) / 1000)
  console.log(`[${ago}s atrás] ${r.dir} | ${r.title} (${r.phone}): "${r.content}"`)
}

await pool.end()
