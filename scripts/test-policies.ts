import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.rpc('get_policies')
    console.log('RPC get_policies (if exists):', data, error?.message)

    // Direct SQL via service role isn't completely straightforward via JS client, 
    // let's try calling a known postgres function or just checking the DB logs

    // We can inject SQL if we have a way. Maybe the MCP server works now? Let's just output the current user metadata
    console.log('Service role key active');
}

main()
