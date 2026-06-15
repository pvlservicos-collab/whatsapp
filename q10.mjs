import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'
config({ path: '.env.local' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(`
  select created_at, direction, phone, payload
  from integration_message_logs
  where direction = 'inbound'
  order by created_at desc
  limit 1
`)
for (const r of rows) {
  const value = r.payload?.entry?.[0]?.changes?.[0]?.value
  console.log('display_phone_number:', value?.metadata?.display_phone_number)
  console.log('phone_number_id:', value?.metadata?.phone_number_id)
  console.log('from:', value?.messages?.[0]?.from)
}

await pool.end()
