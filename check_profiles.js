
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- profiles table query ---');
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    console.log('Error:', error);
    console.log('Data:', data);

    console.log('\n--- organization_members with profiles query ---');
    const { data: data2, error: error2 } = await supabase.from('organization_members').select(`
        id,
        user_id,
        profiles (full_name, avatar_url, email, is_superadmin),
        organization_roles (name)
    `);

    console.log('Members Error:', error2);
    console.log('Members Data:', JSON.stringify(data2, null, 2));

    console.log('\n--- email column check error ---');
    // If we specifically ask for 'email', let's see what happens if it's not there
    const { data: qData, error: qError } = await supabase.from('profiles').select('email').limit(1);
    console.log('Query Error for just email:', qError);
}

check();
