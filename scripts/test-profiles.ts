import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_URL',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_KEY'
);

async function check() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').limit(1);
    console.log('Data:', data)
    console.log('Error:', error)

    const { data: data2, error: error2 } = await supabase.from('organization_members').select(`
      id,
      profiles (full_name, avatar_url, email, is_superadmin)
  `).limit(1);
    console.log('Members Data:', JSON.stringify(data2, null, 2))
    console.log('Members Error:', error2)


}
check();
