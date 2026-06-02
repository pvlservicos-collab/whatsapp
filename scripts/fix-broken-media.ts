import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.resolve(__dirname, '../atlas-eye/.env.local')
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=')
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim()
                const val = trimmed.substring(eqIndex + 1).trim()
                if (!process.env[key]) process.env[key] = val
            }
        }
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fixBrokenMedia() {
    const { data: orgs } = await supabase.from('integrations').select('organization_id, config').eq('name', 'WhatsApp Lite')
    if (!orgs) return

    for (const org of orgs) {
        const token = (org.config as any)?.instanceToken;
        if (!token) continue;

        const { data: acts } = await supabase.from('lead_activities')
            .select('id, metadata, lead_id')
            .not('metadata->media_url', 'is', null)

        if (!acts) continue;

        for (const act of acts) {
            const url = act.metadata.media_url as string;
            // Extract file path from URL
            const urlPath = url.split('chat_media/')[1];
            if (!urlPath) continue;

            const { data: fileInfo, error: fileErr } = await supabase.storage.from('chat_media').list(urlPath.substring(0, urlPath.lastIndexOf('/')));
            if (!fileInfo) continue;

            const fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            const file = fileInfo.find(f => f.name === fileName);

            // If file size is around 148 bytes, it's the broken json error
            if (file && file.metadata && (file.metadata.size < 200 || file.metadata.size === 148)) {
                console.log(`Fixing broken media for activity ${act.id} (size ${file.metadata.size})`);
                const msgId = act.metadata.message_id;

                const downloadRes = await fetch(`https://atlas-solutions.uazapi.com/message/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'token': token },
                    body: JSON.stringify({ id: msgId, return_base64: false })
                });

                if (downloadRes.ok) {
                    const downloadData = await downloadRes.json();
                    if (downloadData && downloadData.fileURL) {
                        const actualFileRes = await fetch(downloadData.fileURL);
                        if (actualFileRes.ok) {
                            const buffer = await actualFileRes.arrayBuffer();
                            await supabase.storage.from('chat_media').upload(urlPath, buffer, {
                                contentType: act.metadata.media_mimetype || 'application/octet-stream',
                                upsert: true
                            });
                            console.log(`   ✅ Restored file from Uazapi: ${urlPath}`);
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    console.log('✅ Done fixing broken media!')
}

fixBrokenMedia().catch(console.error)
