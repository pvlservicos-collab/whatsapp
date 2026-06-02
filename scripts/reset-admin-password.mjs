// Reset a Supabase Auth user's password via admin API.
// Usage: node scripts/reset-admin-password.mjs <email> <newPassword>

import { createClient } from 'file:///C:/Users/venan/.pgclient/node_modules/@supabase/supabase-js/dist/index.mjs'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)

const [,, email, newPassword] = process.argv
if (!email || !newPassword) { console.error('usage: reset-admin-password.mjs <email> <password>'); process.exit(1) }

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Find the user by email
const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) { console.error(listErr); process.exit(1) }
const user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
if (!user) { console.error(`no user with email ${email}`); process.exit(1) }

const { data, error } = await sb.auth.admin.updateUserById(user.id, { password: newPassword })
if (error) { console.error('update failed:', error); process.exit(1) }
console.log(`OK: password updated for ${data.user.email} (id=${data.user.id})`)
