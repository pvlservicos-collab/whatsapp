/**
 * Testa a verificação de assinatura X-Hub-Signature-256 do webhook do Facebook
 * (src/app/api/webhooks/facebook/route.ts) contra um servidor rodando localmente.
 *
 * Uso:
 *   1. Garanta que FACEBOOK_APP_SECRET está em .env.local (qualquer valor serve
 *      para este teste local — não precisa ser o secret real da Meta).
 *   2. Rode `npm run dev` em um terminal.
 *   3. Rode `node scripts/test-facebook-webhook-signature.mjs` em outro.
 *
 * Opcional: `node scripts/test-facebook-webhook-signature.mjs <baseUrl> <orgId>`
 * Passe um org_id real do seu banco de dev para ver um 200 completo; sem isso,
 * o teste usa um UUID nulo e o que importa é confirmar que a resposta NÃO é 403.
 */
import { config } from 'dotenv'
import { createHmac } from 'crypto'

config({ path: '.env.local' })

const secret = process.env.FACEBOOK_APP_SECRET
if (!secret) {
  console.error('FACEBOOK_APP_SECRET não encontrado em .env.local — defina antes de rodar este teste.')
  process.exit(1)
}

const baseUrl = process.argv[2] || 'http://localhost:3000'
const orgId = process.argv[3] || '00000000-0000-0000-0000-000000000000'
const url = `${baseUrl}/api/webhooks/facebook?org_id=${orgId}`

const payload = {
  entry: [{
    id: 'test-waba-id',
    changes: [{
      value: {
        metadata: { display_phone_number: '5511999999999' },
        contacts: [{ profile: { name: 'Teste Assinatura' }, wa_id: '5511988887777' }],
        messages: [{ from: '5511988887777', type: 'text', text: { body: 'Mensagem de teste de assinatura' } }],
      },
    }],
  }],
}
const rawBody = JSON.stringify(payload)
const validSignature = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')

async function post(label, headers, expected) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: rawBody })
  const text = await res.text()
  const mark = expected(res.status) ? '✅' : '❌'
  console.log(`${mark} ${label} → status ${res.status} — ${text.slice(0, 150)}`)
}

async function run() {
  console.log(`Alvo: ${url}\n`)
  await post('Assinatura VÁLIDA (esperado: != 403)', { 'X-Hub-Signature-256': validSignature }, (s) => s !== 403)
  await post('SEM header de assinatura (esperado: 403)', {}, (s) => s === 403)
  await post('Assinatura INVÁLIDA (esperado: 403)', { 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) }, (s) => s === 403)
}

run()
