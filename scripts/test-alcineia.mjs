import pg from 'file:///C:/Users/venan/.pgclient/node_modules/pg/esm/index.mjs'

const c = new pg.Client({ connectionString: process.argv[2] })
await c.connect()

const orgRes = await c.query(`SELECT organization_id, COUNT(*) AS n
  FROM public.leads WHERE deleted_at IS NULL
  GROUP BY organization_id ORDER BY n DESC LIMIT 1`)
const orgId = orgRes.rows[0].organization_id
console.log(`Org: ${orgId} (${orgRes.rows[0].n} leads totais)\n`)

console.log('=== Busca RPC: "alcineia" ===')
const r = await c.query(
  `SELECT match_type, lead->>'title' AS title, lead->>'phone' AS phone,
          substring(snippet, 1, 80) AS snippet_preview, matched_at
   FROM public.search_leads($1, 'alcineia', false, null, 20)`,
  [orgId]
)
console.log(`${r.rows.length} resultado(s):`)
r.rows.forEach((row, i) => {
  console.log(`  ${i+1}. [${row.match_type}] ${row.title} — phone: ${row.phone ?? '(sem)'}${row.snippet_preview ? `\n     snippet: ${row.snippet_preview}` : ''}`)
})

console.log('\n=== Conferindo direto na tabela leads (ILIKE bruto) ===')
const raw = await c.query(
  `SELECT id, title, phone FROM public.leads
   WHERE organization_id=$1 AND deleted_at IS NULL
     AND (title ILIKE '%alcineia%' OR title ILIKE '%alcinéia%' OR title ILIKE '%Alcineia%')
   LIMIT 10`,
  [orgId]
)
console.log(`${raw.rows.length} lead(s) com "alcineia" no título (case/accent ignored):`)
raw.rows.forEach((row, i) => {
  console.log(`  ${i+1}. ${row.title} (${row.phone ?? 'sem phone'})`)
})

console.log('\n=== Conferindo em mensagens (lead_activities.content) ===')
const msg = await c.query(
  `SELECT a.lead_id, l.title, substring(a.content, 1, 100) AS snip
   FROM public.lead_activities a
   JOIN public.leads l ON l.id = a.lead_id
   WHERE a.organization_id=$1 AND a.type IN ('whatsapp','email')
     AND a.content ILIKE '%alcineia%' LIMIT 5`,
  [orgId]
)
console.log(`${msg.rows.length} mensagem(ns) com "alcineia" no conteúdo`)
msg.rows.forEach((row, i) => console.log(`  ${i+1}. ${row.title}: ${row.snip}`))

await c.end()
