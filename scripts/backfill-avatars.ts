/**
 * Backfill script: Fetches WhatsApp avatars for all leads missing profile pictures.
 * 
 * Usage: npx tsx scripts/backfill-avatars.ts
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or .env file)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, '../atlas-eye/.env.local')
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=')
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim()
                const val = trimmed.substring(eqIndex + 1).trim()
                if (!process.env[key]) process.env[key] = val
            }
        }
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.error('   Set them in atlas-eye/.env.local or as environment variables')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function backfillAvatars() {
    console.log('🔍 Finding leads without avatars...')

    // Get all leads without avatar
    const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, phone, title, organization_id')
        .is('avatar_url', null)
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })

    if (leadsErr) {
        console.error('❌ Failed to fetch leads:', leadsErr.message)
        return
    }

    console.log(`📋 Found ${leads?.length || 0} leads without avatars\n`)

    if (!leads || leads.length === 0) {
        console.log('✅ All leads already have avatars!')
        return
    }

    // Group by organization to fetch tokens efficiently
    const orgTokens: Record<string, string> = {}

    let successCount = 0
    let skipCount = 0
    let failCount = 0

    for (const lead of leads) {
        // Get token for this org (cached)
        if (!orgTokens[lead.organization_id]) {
            const { data: integ } = await supabase
                .from('integrations')
                .select('config')
                .eq('organization_id', lead.organization_id)
                .eq('name', 'WhatsApp Lite')
                .single()

            const token = (integ?.config as any)?.instanceToken
            if (token) {
                orgTokens[lead.organization_id] = token
            } else {
                console.warn(`⚠️  No token for org ${lead.organization_id}, skipping leads in this org`)
                skipCount++
                continue
            }
        }

        const token = orgTokens[lead.organization_id]

        try {
            console.log(`📸 Fetching avatar for "${lead.title}" (${lead.phone})...`)

            const uazapiRes = await fetch('https://atlas-solutions.uazapi.com/chat/details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': token,
                },
                body: JSON.stringify({ number: lead.phone, preview: true }),
            })

            if (!uazapiRes.ok) {
                console.warn(`   ⚠️  Uazapi returned ${uazapiRes.status} for ${lead.phone}`)
                failCount++
                continue
            }

            const data = await uazapiRes.json()
            const imageUrl = data?.imagePreview

            if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
                console.log(`   ⏭️  No profile picture available for "${lead.title}"`)
                skipCount++
                continue
            }

            // Download image
            const imgRes = await fetch(imageUrl)
            if (!imgRes.ok) {
                console.warn(`   ⚠️  Failed to download image for "${lead.title}"`)
                failCount++
                continue
            }

            const imgBuffer = await imgRes.arrayBuffer()
            const fileName = `${lead.organization_id}/${lead.id}-${Date.now()}.jpg`

            // Upload to Storage
            const { error: uploadErr } = await supabase.storage
                .from('avatars')
                .upload(fileName, imgBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadErr) {
                console.warn(`   ❌ Upload failed for "${lead.title}":`, uploadErr.message)
                failCount++
                continue
            }

            const publicUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl

            // Update lead
            await supabase.from('leads').update({ avatar_url: publicUrl }).eq('id', lead.id)

            console.log(`   ✅ Avatar saved for "${lead.title}"`)
            successCount++

            // Rate limit: wait 500ms between requests
            await new Promise(r => setTimeout(r, 500))

        } catch (err: any) {
            console.warn(`   ❌ Error for "${lead.title}":`, err.message)
            failCount++
        }
    }

    console.log(`\n📊 Results:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ⏭️  Skipped: ${skipCount}`)
    console.log(`   ❌ Failed:  ${failCount}`)
}

backfillAvatars().catch(console.error)
