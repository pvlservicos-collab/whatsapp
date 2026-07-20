import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function testQuery() {
    // 1. Get the user link to log in
    const admin = createClient(supabaseUrl, supabaseAdminKey)
    const { data: { users } } = await admin.auth.admin.listUsers()
    const marcos = users.find(u => u.email === 'marcos@atlaseye.com.br')

    if (!marcos) return;

    // Create an anon client
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey)

    // We cannot easily get a session without the password or a magic link click.
    // BUT we can use the admin client to generate an access token if we use the admin.createUser / admin.updateUser? No.
    // Actually, can we just use the service_role client and pass the 'Authorization' header overriding the JWT? Yes.
    // But how to generate the JWT? We can't easily sign it without the JWT secret.

    // Let's just generate a real link and extract the token if possible? No.
    console.log("Without JWT secret or password, I can't easily test RLS locally for a specific user.")
}

testQuery()
