import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data: pipelines } = await supabase.from('pipelines').select('id, name').eq('organization_id', 'd17ec329-e074-46a0-b5a4-f3617e161cca')
    console.log('Pipelines:', pipelines)

    const { data: stages } = await supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('organization_id', 'd17ec329-e074-46a0-b5a4-f3617e161cca')
    console.log('Stages:', stages)
}

main()
