const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: orgs, error } = await supabase.from('organizations').select('*').limit(1);
    console.log('Orgs columns:', orgs && orgs.length > 0 ? Object.keys(orgs[0]) : error);

    const { data: apiNotifs, error: err2 } = await supabase.from('api_notifications').select('*').limit(1);
    console.log('Api Notifs err:', err2);

    // Also check for `api_notification_events` or similar
    const { data: events, error: err3 } = await supabase.from('notification_events').select('*').limit(1);
    console.log('Notification events err:', err3);
}

check();
