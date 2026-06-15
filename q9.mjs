import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`
  select id, type, config from integrations where type = 'whatsapp_cloud_official'
`)
for (const r of rows) console.log(JSON.stringify(r, null, 2))

await pool.end()
