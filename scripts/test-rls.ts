import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'marcos@atlaseye.com.br',
        password: 'password123' // Or something, wait I don't know the password!
    })
}

main()
