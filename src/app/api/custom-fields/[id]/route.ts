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

export async function GET(
    req: NextRequest,
    context: any
) {
    try {
        const id = context.params?.id || context.params?.id;

        if (!id) {
            return apiError(400, 'Custom Field ID is required')
        }

        const auth = await authenticateRequest(req)
        // db is imported globally

        const { data, error } = await supabase
            .from('custom_field_definitions')
            .select('id, name, field_type, schema, key')
            .eq('organization_id', auth.organizationId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return apiError(404, 'Custom field not found')
            }
            return apiError(500, error.message)
        }

        // Extract options if it's a select or multi_select
        let options: string[] = []
        if (data && data.schema && typeof data.schema === 'object') {
            const schemaObj = data.schema as Record<string, any>;
            if (Array.isArray(schemaObj.options)) {
                options = schemaObj.options;
            } else if (Array.isArray(schemaObj.choices)) {
                options = schemaObj.choices;
            }
        }

        return Response.json({
            id: data.id,
            name: data.name,
            key: data.key,
            type: data.field_type,
            options: options
        })
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Internal error')
    }
}
