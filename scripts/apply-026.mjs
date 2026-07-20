// Apply database/026_lead_search.sql against the configured Postgres.
// Handles CREATE INDEX CONCURRENTLY correctly (runs each statement outside a tx).
// Usage: node scripts/apply-026.mjs "<connection-string>"

import pg from 'file:///C:/Users/venan/.pgclient/node_modules/pg/esm/index.mjs'
import { readFileSync } from 'node:fs'

const conn = process.argv[2]
if (!conn) {
  console.error('Usage: node scripts/apply-026.mjs "<connection-string>"')
  process.exit(1)
}

const sqlFile = readFileSync(new URL('../database/026_lead_search.sql', import.meta.url), 'utf8')

// Split on semicolons that end a statement, preserving $$...$$ dollar-quoted blocks.
function splitStatements(sql) {
  const stmts = []
  let buf = ''
  let i = 0
  let inDollar = null // tag like $$ or $body$
  while (i < sql.length) {
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([A-Za-z_]*)\$/)
      if (m) { inDollar = m[0]; buf += m[0]; i += m[0].length; continue }
      const ch = sql[i]
      if (ch === ';') { stmts.push(buf.trim()); buf = ''; i++; continue }
      if (ch === '-' && sql[i+1] === '-') {
        const nl = sql.indexOf('\n', i); if (nl === -1) break
        buf += sql.slice(i, nl+1); i = nl+1; continue
      }
      buf += ch; i++
    } else {
      if (sql.slice(i).startsWith(inDollar)) {
        buf += inDollar; i += inDollar.length; inDollar = null; continue
      }
      buf += sql[i]; i++
    }
  }
  if (buf.trim()) stmts.push(buf.trim())
  return stmts.filter(s => s.length > 0)
}

const statements = splitStatements(sqlFile)
console.log(`Parsed ${statements.length} statement(s).`)

const client = new pg.Client({ connectionString: conn })
try {
  await client.connect()
  console.log('Connected.')
  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx]
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90)
    process.stdout.write(`[${idx+1}/${statements.length}] ${preview}… `)
    try {
      await client.query(stmt)
      console.log('OK')
    } catch (e) {
      console.log('FAIL')
      console.error(`  → ${e.message}`)
      throw e
    }
  }
  console.log('\nMigration applied successfully.')
} finally {
  await client.end()
}
