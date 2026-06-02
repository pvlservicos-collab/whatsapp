import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkPipelines() {
    // 1. Get the organization ID from the DB
    const { data: orgs } = await supabaseAdmin.from('organizations').select('id, name').limit(1);
    if (!orgs || orgs.length === 0) {
        console.error("No organizations found.");
        return;
    }
    const orgId = orgs[0].id;
    console.log(`Checking org: ${orgs[0].name} (${orgId})`);

    // 2. Fetch pipelines as admin
    const { data: pipes, error: pErr } = await supabaseAdmin
        .from('pipelines')
        .select('*')
        .eq('organization_id', orgId);

    if (pErr) console.error("Error fetching pipelines:", pErr);
    else console.log(`Found ${pipes?.length} pipelines.`);

    if (pipes && pipes.length > 0) {
        console.log("Pipelines data:", pipes);
        // 3. Fetch stages for that pipeline
        const pipelineId = pipes[0].id;
        const { data: stages, error: sErr } = await supabaseAdmin
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', pipelineId);

        if (sErr) console.error("Error fetching stages:", sErr);
        else console.log(`Found ${stages?.length} stages for pipeline ${pipelineId}`);
        if (stages) console.log(stages.map(s => ({ id: s.id, name: s.name, deleted_at: s.deleted_at })));
    }
}

checkPipelines();
