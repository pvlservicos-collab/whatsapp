import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired, validateSource } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { publishEvent, channels, events } from '@/lib/realtime'
import {
  leads, leadActivities, leadTags, tags, organizationMembers, profiles,
  pipelineStages, pipelines, integrations, organizationRoles,
  customFieldDefinitions, customFieldCategories, notifications, apiTokens,
  organizations, setupTokens, leadStageHistory, integrationSecrets,
} from '@/lib/schema'
import { eq, and, isNull, desc, asc, ilike, or, sql, ne, inArray, notInArray } from 'drizzle-orm'

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper to get a service role client that bypasses RLS
const createSupabaseAdmin = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const { id: workspaceId } = await request.json()
        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID é obrigatório' }, { status: 400 })
        }

        // 1. Verify caller is Superadmin
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 })
        }

        // db is imported globally

        // Assuming we verify via the profiles table using supabaseAdmin bypassing RLS for safety
        const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('is_superadmin')
            .eq('id', user.id)
            .single()

        if (profileErr || !profile?.is_superadmin) {
            return NextResponse.json({ error: 'Permissão negada. Apenas Superadmins podem deletar workspaces.' }, { status: 403 })
        }

        // 2. Execute the cascading deletion stored procedure
        const { error: deleteError } = await supabaseAdmin.rpc('delete_organization_cascade', {
            org_uuid: workspaceId
        })

        if (deleteError) {
            console.error('[delete-workspace] RPC Error details:', deleteError)
            throw new Error(`Falha ao deletar workspace: ${deleteError.message}`)
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('[delete-workspace] Unexpected admin error:', err)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
