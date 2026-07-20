/**
 * One-off script to synchronize WhatsApp Avatars for all existing leads that are missing them.
 * Run from project root: node scripts/sync-avatars.mjs
 */

const SUPABASE_URL = 'https://hklfcfadultzuhwgkqmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGZjZmFkdWx0enVod2drcW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDY5NzIsImV4cCI6MjA4NjkyMjk3Mn0.X1u0G0Hb0QzpqIXSJpGni6wh1Y64y1lX6v5NiyquYwU';

const { createClient } = await import('../atlas-eye/node_modules/@supabase/supabase-js/dist/index.mjs');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncAvatars() {
    console.log('🔄 Starting Avatar Sync...');

    // 1. Get org
    const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
    if (!org) { console.error('❌ No organization found'); return; }
    console.log(`   Organization: ${org.id}`);

    // 2. Get integration config for UAZAPI
    const { data: integ } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', org.id)
        .eq('name', 'WhatsApp Lite')
        .limit(1)
        .single();

    if (!integ || !integ.config || !integ.config.instanceName || !integ.config.instanceToken) {
        console.error('❌ No WhatsApp Lite integration or missing instance config found');
        return;
    }

    const { instanceName: instance, instanceToken: apikey } = integ.config;
    console.log(`   Instance: ${instance}`);

    // 3. Fetch all leads missing avatars
    const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, title, phone')
        .eq('organization_id', org.id)
        .is('avatar_url', null)
        .not('phone', 'is', null)
        .is('deleted_at', null);

    if (leadsErr) { console.error('❌ Failed fetching leads:', leadsErr); return; }

    console.log(`📋 Found ${leads.length} leads missing avatars.\n`);

    let downloaded = 0;
    let failed = 0;

    for (const lead of leads) {
        process.stdout.write(`   Fetching for ${lead.title} (${lead.phone})... `);

        try {
            const uazapiRes = await fetch(`https://atlas-solutions.uazapi.com/chat/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': apikey
                },
                body: JSON.stringify({ number: lead.phone, preview: true })
            });

            if (uazapiRes.ok) {
                const uazapiData = await uazapiRes.json();
                if (uazapiData?.imagePreview) {
                    // Download the image
                    const imgRes = await fetch(uazapiData.imagePreview);
                    if (imgRes.ok) {
                        const imgBuffer = await imgRes.arrayBuffer();
                        const fileExt = 'jpg';
                        const fileName = `${org.id}/${lead.id}-${Date.now()}.${fileExt}`;

                        // Upload to Storage
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('avatars')
                            .upload(fileName, imgBuffer, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (!uploadError && uploadData) {
                            const publicUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;

                            // Update lead
                            await supabase.from('leads').update({ avatar_url: publicUrl }).eq('id', lead.id);

                            console.log(`✅ Success`);
                            downloaded++;
                            continue;
                        } else {
                            console.log(`❌ Upload Error: ${uploadError?.message}`);
                        }
                    } else {
                        console.log(`❌ Download Error: ${imgRes.status}`);
                    }
                } else {
                    console.log(`⏭️  No avatar set by user`);
                }
            } else {
                console.log(`❌ Uazapi Error: ${uazapiRes.status}`);
            }
        } catch (err) {
            console.log(`❌ Script Error: ${err.message}`);
        }

        failed++;
        // Rate limiting buffer
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n========================================`);
    console.log(`  ✅ Downloaded: ${downloaded}`);
    console.log(`  ❌ Failed/No Avatar: ${failed}`);
    console.log(`========================================`);
}

syncAvatars();
