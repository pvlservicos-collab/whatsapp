/**
 * One-off script to synchronize all WhatsApp Groups from Uazapi into the CRM as Leads.
 * Run from project root: node scripts/sync-groups.mjs
 */

// --- Config (hardcoded for one-off use) ---
const SUPABASE_URL = 'https://hklfcfadultzuhwgkqmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGZjZmFkdWx0enVod2drcW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDY5NzIsImV4cCI6MjA4NjkyMjk3Mn0.X1u0G0Hb0QzpqIXSJpGni6wh1Y64y1lX6v5NiyquYwU';
const UAZAPI_TOKEN = 'b8004a66-4934-47d6-8eb7-ad73cb3d907e';
const UAZAPI_URL = 'https://atlas-solutions.uazapi.com/group/list';

// Use dynamic import for supabase-js from atlas-eye's node_modules
const { createClient } = await import('../atlas-eye/node_modules/@supabase/supabase-js/dist/index.mjs');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncGroups() {
    console.log('🔄 Fetching groups from Uazapi...');

    // Get org
    const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
    if (!org) { console.error('❌ No organization found'); return; }
    console.log(`   Organization: ${org.id}`);

    // Get integration
    const { data: integ } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', org.id)
        .eq('name', 'WhatsApp Lite')
        .limit(1)
        .single();

    if (!integ) { console.error('❌ No WhatsApp Lite integration found'); return; }

    const defaultPipelineId = integ.config?.defaultPipelineId;
    let targetStageId = null;

    if (defaultPipelineId) {
        const { data: firstStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', defaultPipelineId)
            .order('rank', { ascending: true })
            .limit(1)
            .single();
        if (firstStage) targetStageId = firstStage.id;
    }

    console.log(`   Pipeline: ${defaultPipelineId || 'N/A'}, Stage: ${targetStageId || 'N/A'}`);

    // Fetch groups from Uazapi
    let groups;
    try {
        const res = await fetch(UAZAPI_URL, {
            headers: { 'Accept': 'application/json', 'token': UAZAPI_TOKEN }
        });
        if (!res.ok) { console.error('❌ Uazapi returned:', res.status, res.statusText); return; }
        const raw = await res.json();
        // Uazapi may return { groups: [...] } or just [...]
        groups = Array.isArray(raw) ? raw : (raw.groups || raw.data || Object.values(raw).find(v => Array.isArray(v)) || []);
    } catch (e) {
        console.error('❌ Failed to fetch groups:', e.message);
        return;
    }

    console.log(`📋 Found ${groups.length} groups from Uazapi.\n`);

    let created = 0, updated = 0, skipped = 0;

    for (const group of groups) {
        const rawJID = group.JID;
        if (!rawJID) { skipped++; continue; }

        // Unique phone identifier for the group (digits only from the JID)
        const phone = rawJID.replace(/\D/g, '');
        const title = group.Name || 'Grupo Sem Nome';

        // Check if this group-lead already exists
        const { data: existing } = await supabase
            .from('leads')
            .select('id, title')
            .eq('organization_id', org.id)
            .like('phone', `%${phone}%`)
            .limit(1)
            .single();

        if (existing) {
            if (existing.title !== title) {
                await supabase.from('leads').update({ title }).eq('id', existing.id);
                console.log(`  ✏️  Updated: "${title}"`);
                updated++;
            } else {
                skipped++;
            }
        } else {
            const { error } = await supabase.from('leads').insert({
                organization_id: org.id,
                stage_id: targetStageId,
                title: title,
                phone: phone,
                integration_id: integ.id,
                is_group: true
            });
            if (error) {
                console.error(`  ❌ Error creating "${title}":`, error.message);
            } else {
                console.log(`  ✅ Created: "${title}"`);
                created++;
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ✏️  Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`========================================`);
}

syncGroups();
