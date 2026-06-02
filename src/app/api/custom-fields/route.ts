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

/**
 * GET /api/custom-fields
 * Lists all custom field definitions and categories for the organization.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await authenticateRequest(req)
        // db is imported globally

        // Fetch definitions and categories
        const [defsRes, catsRes] = await Promise.all([
            supabase
                .from('custom_field_definitions')
                .select('id, name, category_id, field_type, schema, key')
                .eq('organization_id', auth.organizationId)
                .is('deleted_at', null)
                .order('rank', { ascending: true }),

            supabase
                .from('custom_field_categories')
                .select('id, name')
                .eq('organization_id', auth.organizationId)
                .order('rank', { ascending: true })
        ])

        if (defsRes.error) return apiError(500, defsRes.error.message)
        if (catsRes.error) return apiError(500, catsRes.error.message)

        const categoriesMap = new Map(catsRes.data.map(c => [c.id, c.name]))

        // Format the output by mapping category names
        const customFields = defsRes.data.map(field => {
            const isRequired = field.schema && typeof field.schema === 'object' && (field.schema as any).required === true;
            let options: string[] = []
            if (field.schema && typeof field.schema === 'object') {
                const schemaObj = field.schema as Record<string, any>;
                if (Array.isArray(schemaObj.options)) options = schemaObj.options;
                else if (Array.isArray(schemaObj.choices)) options = schemaObj.choices;
            }
            return {
                id: field.id,
                name: field.name,
                key: field.key,
                category: categoriesMap.get(field.category_id) || 'General',
                type: field.field_type || 'text',
                is_required: isRequired,
                options
            };
        })

        return Response.json(customFields)
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}
