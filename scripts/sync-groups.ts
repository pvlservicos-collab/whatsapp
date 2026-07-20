import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'atlas-eye/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// or fallback
const backupKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY || backupKey!);

async function syncGroups() {
    console.log('Fetching groups from Uazapi...');

    // 1. You would usually get this dynamically, but for this specific sync:
    const UAZAPI_TOKEN = 'b8004a66-4934-47d6-8eb7-ad73cb3d907e';
    const UAZAPI_URL = 'https://atlas-solutions.uazapi.com/group/list';

    // Get org and integration
    const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
    if (!org) throw new Error('No organization found');

    const { data: integ } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', org.id)
        .eq('name', 'WhatsApp Lite')
        .limit(1)
        .single();

    if (!integ) throw new Error('No integration found');

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

    try {
        const res = await fetch(UAZAPI_URL, {
            headers: {
                'Accept': 'application/json',
                'token': UAZAPI_TOKEN
            }
        });

        if (!res.ok) {
            console.error('Failed to fetch from Uazapi:', res.statusText);
            return;
        }

        const groups = await res.json();
        console.log(`Found ${groups.length} groups.`);

        let syncedCount = 0;

        for (const group of groups) {
            const rawPhone = group.JID;
            if (!rawPhone) continue;

            const phone = rawPhone.replace(/\D/g, '');
            const title = group.Name || 'Grupo Sem Nome';

            // Check if exists
            const { data: existing } = await supabase
                .from('leads')
                .select('id, title')
                .eq('organization_id', org.id)
                .like('phone', `%${phone}%`)
                .single();

            if (existing) {
                // Update title if needed
                if (existing.title !== title) {
                    await supabase.from('leads').update({ title }).eq('id', existing.id);
                    console.log(`Updated group name: ${title}`);
                }
            } else {
                // Create
                const { error } = await supabase.from('leads').insert({
                    organization_id: org.id,
                    pipeline_id: defaultPipelineId,
                    stage_id: targetStageId,
                    title: title,
                    phone: phone,
                    source: 'whatsapp',
                    source_id: phone,
                    integration_id: integ.id,
                    is_group: true
                });
                if (error) {
                    console.error('Error inserting group:', error.message);
                } else {
                    console.log(`Created group lead: ${title}`);
                    syncedCount++;
                }
            }
        }

        console.log(`\nSynchronization complete! ${syncedCount} new groups added.`);
    } catch (e) {
        console.error('Error during sync:', e);
    }
}

syncGroups();
