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

import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired, validateSource } from '@/lib/api-auth'
// Migrated to Neon/Drizzle - imports are at top level

/**
 * PATCH /api/leads/history/[event_id]
 * Edita um evento do histórico
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ event_id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { event_id } = await params
        const body = await req.json()

        const requiredError = validateRequired(body, ['source'])
        if (requiredError) return apiError(400, requiredError)
        const sourceError = validateSource(body.source)
        if (sourceError) return apiError(400, sourceError)

        // db is imported globally

        // Verify event belongs to org
        const { data: existing } = await supabase
            .from('lead_activities')
            .select('id, metadata')
            .eq('id', event_id)
            .eq('organization_id', auth.organizationId)
            .single()

        if (!existing) return apiError(404, 'Evento não encontrado.')

        const updates: Record<string, any> = {}
        if (body.content !== undefined) updates.content = body.content
        if (body.metadata !== undefined) updates.metadata = { ...(existing.metadata || {}), ...body.metadata, source: body.source }

        const { data, error } = await supabase
            .from('lead_activities')
            .update(updates)
            .eq('id', event_id)
            .select('id, type, content, metadata, created_at')
            .single()

        if (error) return apiError(500, error.message)
        return Response.json(data)
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}

/**
 * DELETE /api/leads/history/[event_id]
 * Exclui permanentemente um evento do histórico
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ event_id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { event_id } = await params

        const source = req.nextUrl.searchParams.get('source')
        if (!source) return apiError(400, 'Campo obrigatório ausente: source (query param)')
        const sourceError = validateSource(source)
        if (sourceError) return apiError(400, sourceError)

        // db is imported globally

        // Verify event belongs to org
        const { data: existing } = await supabase
            .from('lead_activities')
            .select('id')
            .eq('id', event_id)
            .eq('organization_id', auth.organizationId)
            .single()

        if (!existing) return apiError(404, 'Evento não encontrado.')

        const { error } = await supabase
            .from('lead_activities')
            .delete()
            .eq('id', event_id)

        if (error) return apiError(500, error.message)
        return new Response(null, { status: 204 })
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}
