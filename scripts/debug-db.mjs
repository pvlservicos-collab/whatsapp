import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need to use Anon key to test RLS
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login as the user to test RLS correctly
async function debugDatabase() {
    console.log('--- Logging in as Venâncio ---');
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'marcos@atlaseye.com.br',
        password: 'password123' // Just guessing, or we can just fetch without logging in to see if RLS blocks public.
    });
    // Actually, RLS blocks anon, so we need a valid JWT. Wait, I can just use my debug-user-rls script
    // which didn't get finished. Let's just create a new script.
    console.log('--- Auth Users ---');
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) console.error(usersErr);
    else {
        users.users.forEach(u => console.log(u.email, u.user_metadata));
    }

    console.log('\n--- Profiles ---');
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
    if (pErr) console.error(pErr);
    else console.log(profiles);

    console.log('\n--- Organizations ---');
    const { data: orgs, error: oErr } = await supabase.from('organizations').select('*').limit(5);
    if (oErr) console.error(oErr);
    else console.log(orgs);

    console.log('\n--- Organization Members ---');
    const { data: members, error: mErr } = await supabase.from('organization_members').select('*').limit(5);
    if (mErr) console.error(mErr);
    else console.log(members);

    console.log('\n--- Pipelines ---');
    const { data: pipes, error: pipesErr } = await supabase.from('pipelines').select('*').limit(5);
    if (pipesErr) console.error(pipesErr);
    else console.log(pipes);

    console.log('\n--- Pipeline Stages ---');
    const { data: stages, error: stErr } = await supabase.from('pipeline_stages').select('*').limit(5);
    if (stErr) console.error(stErr);
    else console.log(stages);
}

debugDatabase();
