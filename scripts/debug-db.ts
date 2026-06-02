import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

async function debugDatabase() {
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
}

debugDatabase();
