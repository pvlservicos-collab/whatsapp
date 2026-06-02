// Smoke-test migration 026: index validity + search_leads RPC behavior.
// Usage: node scripts/smoke-026.mjs "<connection-string>"

import pg from 'file:///C:/Users/venan/.pgclient/node_modules/pg/esm/index.mjs'

const conn = process.argv[2]
if (!conn) { console.error('missing conn string'); process.exit(1) }

const c = new pg.Client({ connectionString: conn })
await c.connect()

let failures = 0
const check = (label, cond, extra) => {
  if (cond) console.log(`PASS  ${label}`)
  else { console.error(`FAIL  ${label}`, extra ?? ''); failures++ }
}

// 1. Indexes valid
const idx = await c.query(`
  SELECT indexrelid::regclass::text AS name, indisvalid
  FROM pg_index WHERE indexrelid::regclass::text LIKE '%_trgm'
  ORDER BY name;
`)
check('4 trigram indexes exist', idx.rows.length === 4, idx.rows)
check('all trigram indexes valid', idx.rows.every(r => r.indisvalid), idx.rows)

// 2. Helpers work
const h1 = await c.query(`SELECT public.leads_phone_digits('+55 (84) 91234-5678') AS r`)
check('leads_phone_digits strips non-digits', h1.rows[0].r === '5584912345678', h1.rows[0])
const h2 = await c.query(`SELECT public.norm_text('Alcinéia DA SILVA') AS r`)
check('norm_text removes accents + lowercases', h2.rows[0].r === 'alcineia da silva', h2.rows[0])

// 3. Pick any org that has at least one lead
const orgRes = await c.query(`SELECT organization_id, COUNT(*) AS n
  FROM public.leads WHERE deleted_at IS NULL
  GROUP BY organization_id ORDER BY n DESC LIMIT 1`)
if (!orgRes.rows.length) { console.error('no leads in db'); process.exit(1) }
const orgId = orgRes.rows[0].organization_id
console.log(`Using org ${orgId} (${orgRes.rows[0].n} leads)`)

// 4. q<3 returns nothing
const short = await c.query(`SELECT * FROM public.search_leads($1, 'al', false, null, 50)`, [orgId])
check('q<3 returns empty', short.rows.length === 0)

// 5. Wrong org returns nothing
const wrong = await c.query(`SELECT * FROM public.search_leads('00000000-0000-0000-0000-000000000000', 'xxx', false, null, 50)`)
check('wrong org returns empty', wrong.rows.length === 0)

// 6. Seed a lead with accented name + formatted phone and verify accent-insensitive match
const seed = await c.query(
  `INSERT INTO public.leads (organization_id, title, phone)
   VALUES ($1, 'Alcinéia Teste Smoke', '+55 (84) 91234-5678') RETURNING id`,
  [orgId]
)
const leadId = seed.rows[0].id
try {
  const name = await c.query(
    `SELECT lead_id, match_type FROM public.search_leads($1, 'alcineia', false, null, 50)`,
    [orgId]
  )
  check(
    'accent-insensitive name match',
    name.rows.some(r => r.lead_id === leadId && r.match_type === 'title'),
    name.rows.find(r => r.lead_id === leadId) ?? '(not found)'
  )

  const phone = await c.query(
    `SELECT lead_id, match_type FROM public.search_leads($1, '91234567', false, null, 50)`,
    [orgId]
  )
  check(
    'phone digits substring match',
    phone.rows.some(r => r.lead_id === leadId && r.match_type === 'phone'),
    phone.rows.find(r => r.lead_id === leadId) ?? '(not found)'
  )

  // Insert 3 messages with a unique marker
  const marker = `ZYXTESTE${Date.now()}`
  for (let i = 0; i < 3; i++) {
    await c.query(
      `INSERT INTO public.lead_activities (organization_id, lead_id, type, content)
       VALUES ($1, $2, 'whatsapp', $3)`,
      [orgId, leadId, `Mensagem ${i} sobre ${marker} agendado`]
    )
  }
  const msg = await c.query(
    `SELECT lead_id, match_type, snippet, matched_at FROM public.search_leads($1, $2, false, null, 50)`,
    [orgId, marker.toLowerCase()]
  )
  const mine = msg.rows.filter(r => r.lead_id === leadId)
  check('one row per lead for message match (DISTINCT ON)', mine.length === 1, mine)
  check('snippet present and contains marker', mine[0]?.snippet?.includes(marker))
  check('matched_at present', !!mine[0]?.matched_at)
  check('match_type=message', mine[0]?.match_type === 'message')

  // view_own_only with a foreign member excludes the lead
  const foreign = await c.query(
    `SELECT lead_id FROM public.search_leads($1, 'alcineia', true, '00000000-0000-0000-0000-000000000000', 50)`,
    [orgId]
  )
  check(
    'view_own_only with foreign member excludes lead',
    !foreign.rows.some(r => r.lead_id === leadId),
    foreign.rows
  )
} finally {
  await c.query(`DELETE FROM public.lead_activities WHERE lead_id = $1`, [leadId])
  await c.query(`DELETE FROM public.leads WHERE id = $1`, [leadId])
  console.log('cleaned up test lead + activities')
}

await c.end()
if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll checks passed')
