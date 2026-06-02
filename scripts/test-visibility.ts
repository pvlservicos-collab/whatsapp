import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, supabaseServiceKey)
const anon = createClient(supabaseUrl, supabaseAnonKey)

async function testRlsDirectly() {
    // 1. Log in the user by changing their password temporarily (this is a dev environment, right?)
    // Actually no, I don't want to change their password and log them out if they are logged in.
    // However, I can fetch a JWT using the admin auth if I generate a link, but I can't click it.

    // Let's create an RPC to run queries as a specific UI user!
    const setupRpc = `
        CREATE OR REPLACE FUNCTION get_orgs_as_user(user_uuid uuid)
        RETURNS setof public.organizations
        LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN
            -- we can't easily impersonate for RLS within SECURITY DEFINER because it bypasses RLS
            -- unless we use set_config('request.jwt.claim.sub', user_uuid::text, true);
            PERFORM set_config('request.jwt.claim.sub', user_uuid::text, true);
            RETURN QUERY SELECT * FROM public.organizations;
        END;
        $$;
    `
    // Wait, let's just use the GraphQL or POSTGREST directly without changing anything.
    // Instead of doing complex hacks, let's just look at the last script.

    // If RLS blocked everything, maybe the policy on `profiles` is broken?!
    const { data: profilePolicies } = await admin.from('profiles').select('*').limit(1)
    console.log("Admin can read profiles?", !!profilePolicies)
}

testRlsDirectly()
