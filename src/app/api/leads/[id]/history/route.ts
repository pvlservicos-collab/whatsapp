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
 * Resolve um lead por UUID ou telefone.
 */
async function resolveLead(supabase: any, organizationId: string, id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    let query = supabase
        .from('leads')
        .select('id')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)

    if (isUuid) {
        query = query.eq('id', id)
    } else {
        query = query.eq('phone', decodeURIComponent(id))
    }

    const { data: lead } = await query.single()
    return { lead, isUuid, decodedPhone: isUuid ? '' : decodeURIComponent(id) }
}

/**
 * GET /api/leads/[id]/history
 * Retorna todas as atividades do lead (mensagens, notas, ligações, eventos de sistema)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { id } = await params
        // db is imported globally

        const { lead } = await resolveLead(supabase, auth.organizationId, id)
        if (!lead) return apiError(404, 'Lead não encontrado.')

        const { data, error } = await supabase
            .from('lead_activities')
            .select('id, type, content, metadata, actor_member_id, created_at')
            .eq('organization_id', auth.organizationId)
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true })

        if (error) return apiError(500, error.message)
        return Response.json({ data })
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}

/**
 * POST /api/leads/[id]/history
 * Adiciona um evento ao histórico do lead
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { id } = await params
        const body = await req.json()

        const requiredError = validateRequired(body, ['content', 'type', 'source'])
        if (requiredError) return apiError(400, requiredError)
        const sourceError = validateSource(body.source)
        if (sourceError) return apiError(400, sourceError)

        // db is imported globally

        // Verify lead belongs to org
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

        let query = supabase
            .from('leads')
            .select('id')
            .eq('organization_id', auth.organizationId)
            .is('deleted_at', null)

        let decodedPhone = ''
        if (isUuid) {
            query = query.eq('id', id)
        } else {
            decodedPhone = decodeURIComponent(id)
            query = query.eq('phone', decodedPhone)
        }

        const { data: lead } = await query.single()

        let actualLeadId = lead?.id

        if (!actualLeadId) {
            if (isUuid) {
                return apiError(404, 'Lead não encontrado.')
            }

            // Create new lead using phone
            const { data: firstStage } = await supabase
                .from('pipeline_stages')
                .select('id')
                .eq('organization_id', auth.organizationId)
                .is('deleted_at', null)
                .order('rank', { ascending: true })
                .limit(1)
                .single()

            const { data: newLead, error: createError } = await supabase
                .from('leads')
                .insert({
                    organization_id: auth.organizationId,
                    title: decodedPhone,
                    phone: decodedPhone,
                    stage_id: firstStage?.id || null,
                    last_activity_at: new Date().toISOString(),
                    custom_attributes: { source: body.source }
                })
                .select('id')
                .single()

            if (createError) return apiError(500, `Erro ao criar lead automaticamente: ${createError.message}`)
            actualLeadId = newLead.id
        }

        const { data: activity, error } = await supabase
            .from('lead_activities')
            .insert({
                organization_id: auth.organizationId,
                lead_id: actualLeadId,
                actor_member_id: auth.memberId || null,
                type: body.type,
                content: body.content,
                metadata: { ...body.metadata, source: body.source }
            })
            .select('id, type, content, created_at')
            .single()

        if (error) return apiError(500, error.message)

        // Update lead last activity
        await supabase
            .from('leads')
            .update({
                last_activity_at: new Date().toISOString(),
                last_activity_type: body.type,
                last_activity_by_member_id: auth.memberId || null
            })
            .eq('id', actualLeadId)

        return Response.json(activity, { status: 201 })
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}
