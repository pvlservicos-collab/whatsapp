// We need to use Anon key to test RLS like the client does
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPipelinesAsUser() {
    console.log('--- Logging in as Venâncio (venancio@atlaseye.com.br) / Marcos ---');

    // We try 'venancio' or 'marcos' since the user might be using either
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'marcos@atlaseye.com.br',
        password: 'password123'
    });

    if (authErr) {
        console.error("Login as marcos failed:", authErr.message);
        const { error: authErr2 } = await supabase.auth.signInWithPassword({
            email: 'venancio@atlaseye.com.br',
            password: 'password123'
        });
        if (authErr2) {
            console.error("Login as venancio failed:", authErr2.message);
            // Let's create an edge function to do this instead or we just use admin to execute query AS user
            return;
        } else {
            console.log("Logged in as venancio!");
        }
    } else {
        console.log("Logged in as marcos!");
    }

    const { data: user } = await supabase.auth.getUser();
    console.log("User id:", user.user?.id);

    console.log('\n--- Pipelines ---');
    const { data: pipes, error: pipesErr } = await supabase.from('pipelines').select('*');
    if (pipesErr) console.error(pipesErr);
    else console.log("Fetched pipelines count:", pipes?.length);

    console.log('\n--- Pipeline Stages ---');
    const { data: stages, error: stErr } = await supabase.from('pipeline_stages').select('*');
    if (stErr) console.error(stErr);
    else console.log("Fetched stages count:", stages?.length);
    if (stages) console.log(stages.map((s) => ({ name: s.name, id: s.id })));
}

checkPipelinesAsUser();
