# Regra crítica: nunca quebrar envio de mensagens/fluxos/automações para clientes

Este é um CRM em produção (Natura Belas) com clientes reais recebendo mensagens via WhatsApp/Instagram.
Um incidente real (2026-07): um processo zumbi do Next.js ficou preso na porta 3000 servindo código
desatualizado por 25+ min enquanto o PM2 tentava reiniciar em loop e falhava silenciosamente
(`EADDRINUSE`) — a causa raiz de um "não consigo enviar foto para cliente" que na verdade era uma
outage completa. `pm2 list` sozinho NÃO detecta isso.

## Checklist obrigatório após QUALQUER mudança em código que toca envio/automação

Rode isto antes de considerar a tarefa concluída — não basta o build passar:

1. **Status real do processo, não só o que o PM2 diz:**
   ```
   pm2 jlist | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')).filter(p=>p.name==='naturabelas').forEach(p=>console.log(p.pid,p.pm2_env.status,p.pm2_env.restart_time))"
   ss -ltnp | grep :3000
   ```
   Confirme que o pid que está de fato ouvindo a porta 3000 é filho do pid que o PM2 reporta (via `ps -eo pid,ppid,cmd`), uptime coerente, e `restart_time` não subindo em loop.

2. **Endpoint que toca o banco de verdade:**
   ```
   curl -s -o /dev/null -w 'HTTP=%{http_code}\n' https://naturabelas.folemmidia.com/login
   curl -s -m 10 -o /dev/null -w 'HTTP=%{http_code}\n' https://naturabelas.folemmidia.com/api/funnels/tick
   ```
   Ambos devem retornar 200.

3. **Se a mudança tocou em rota de mensagens, adapter de canal, upload/storage ou automações
   (`leadAutomations.ts`, `quick_reply_steps`, `channel adapters`, `/api/upload`, `/api/webhooks/*`):**
   faça um envio de ponta a ponta usando o **lead de teste seguro** — nunca um cliente real:
   - Lead: "Diagnóstico Teste", id `57368a1f-16b9-4c0e-b5d3-4165c64a361f`
   - Teste tanto texto quanto mídia (se a mudança envolveu mídia), esperando HTTP 201 e `send_status: "sent"`.
   - Payload mínimo de mensagem: `{"type":"whatsapp","source":"human","content":"...","media_url":"...","media_type":"image"}` (todos os três primeiros campos são obrigatórios).

## Outras regras específicas deste projeto

- **Nunca usar `localhost` em URLs de serviço internas** (Postgres, Evolution, etc.) — usar `127.0.0.1`.
  O ingress do Swarm trava em IPv6 (`::1`).
- **Antes de assumir qual container Docker serve uma porta**, confirmar com
  `docker service ls --format '{{.Name}}\t{{.Ports}}'` em vez de inferir pelo nome.
- **Nunca commitar `.env*` reais** — `.gitignore` já cobre `.env*` + `!.env.local.example` + `*.bak`,
  mas sempre revisar `git status`/`git diff` antes de commit em áreas que tocam segredos.
- Repo tem duas cópias divergentes: local (Mac, branch `main`) e VPS `/home/admin/naturabelas`
  (branch `master`, tracking `vps-production`) — a VPS é a cópia que roda em produção de verdade.
  Mudanças feitas direto na VPS via SSH precisam ser commitadas lá também, não só localmente.
