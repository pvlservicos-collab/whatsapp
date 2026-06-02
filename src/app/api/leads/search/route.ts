import { NextRequest, NextResponse } from 'next/server'
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
import type { LeadWithOwner, SearchHit, LeadMatchType } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface SearchBody {
  q?: string
  limit?: number
}

interface SearchLeadRow {
  lead_id: string
  match_type: LeadMatchType
  snippet: string | null
  matched_at: string | null
  lead: LeadWithOwner
}

/**
 * POST /api/leads/search
 * Full-text + accent-insensitive search over leads.
 * Delegates to the `public.search_leads` RPC.
 */
export async function POST(req: NextRequest) {
  try {
    const body: SearchBody = await req.json().catch(() => ({} as SearchBody))
    const q = (body.q ?? '').trim()
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 100)

    if (q.length < 3) {
      return NextResponse.json({ error: 'q must be at least 3 characters' }, { status: 400 })
    }

    const auth = await authenticateRequest(req)
    // db is imported globally

    // Resolve caller's member id (for JWT auth) + role permissions.
    let memberId: string | null = auth.memberId
    let viewOwnOnly = false

    if (auth.userId) {
      const { data: callerMember } = await supabase
        .from('organization_members')
        .select('id, role_id')
        .eq('organization_id', auth.organizationId)
        .eq('user_id', auth.userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle()

      if (callerMember?.id) {
        memberId = callerMember.id
      }

      if (callerMember?.role_id) {
        const { data: callerRole } = await supabase
          .from('organization_roles')
          .select('name, permissions')
          .eq('id', callerMember.role_id)
          .maybeSingle()

        const isFixedAdmin =
          callerRole?.name?.toLowerCase() === 'administrador' ||
          callerRole?.name?.toLowerCase() === 'master' ||
          auth.isSuperAdmin

        if (!isFixedAdmin) {
          viewOwnOnly =
            (callerRole?.permissions as { leads?: { view_own_only?: boolean } } | null)
              ?.leads?.view_own_only === true
        }
      }
    }

    const { data, error } = await supabase.rpc('search_leads', {
      p_org: auth.organizationId,
      p_q: q,
      p_view_own_only: viewOwnOnly,
      p_member_id: viewOwnOnly ? memberId : null,
      p_limit: limit,
    })

    if (error) {
      console.error('[api/leads/search] RPC error', error)
      return NextResponse.json({ error: 'search failed' }, { status: 500 })
    }

    const rows = (data ?? []) as SearchLeadRow[]
    const hits: SearchHit[] = rows.map((row) => ({
      lead: row.lead,
      matchType: row.match_type,
      snippet: row.snippet ?? undefined,
      matchedAt: row.matched_at ?? undefined,
    }))

    return NextResponse.json({ hits })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return apiError(e.status || 500, e.message || 'Erro interno.')
  }
}
