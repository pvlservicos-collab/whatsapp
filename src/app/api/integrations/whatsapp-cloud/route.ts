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

const STAGE_FOLLOWUP = 'd3d3031f-bc4b-44df-bd83-b1f07d7fbf85';
const STAGE_ABOUT_TO_PAY = '0a58795e-31c1-4cdd-9cfa-408412d5ce7a';

/**
 * Verify that the authenticated member has `manage_integrations` permission
 * on their organization. For API tokens (no memberId) we assume the token
 * itself is scoped/issued with admin privileges (same assumption used
 * elsewhere in the codebase).
 */
async function assertManageIntegrations(auth: Awaited<ReturnType<typeof authenticateRequest>>) {
    if (auth.isSuperAdmin) return;
    // API token path: no memberId. Trust the token scope.
    if (!auth.memberId || !auth.roleId) return;

    // db is imported globally;
    const { data: role, error } = await supabaseAdmin
        .from('organization_roles')
        .select('permissions')
        .eq('id', auth.roleId)
        .single();

    if (error || !role) {
        throw { status: 403, message: 'Não foi possível validar permissões do usuário.' };
    }

    const perms = (role.permissions || {}) as Record<string, any>;
    const allowed =
        perms.manage_integrations === true ||
        perms['*'] === true ||
        perms.all === true;

    if (!allowed) {
        throw { status: 403, message: 'Permissão negada: requer manage_integrations.' };
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await authenticateRequest(req);
        await assertManageIntegrations(auth);

        const body = await req.json().catch(() => ({}));
        const { waba_id, phone_number_id, system_token, graph_api_version } = body ?? {};

        const missing = validateRequired(body ?? {}, ['waba_id', 'phone_number_id', 'system_token']);
        if (missing) return apiError(400, missing);

        const organizationId = auth.organizationId;
        // db is imported globally;

        const config = {
            waba_id,
            phone_number_id,
            graph_api_version: graph_api_version ?? 'v21.0',
            templates: {
                [STAGE_FOLLOWUP]: 'follow_up_avaliacao',
                [STAGE_ABOUT_TO_PAY]: 'followup_comprovante',
            },
        };

        const { data: existing, error: selErr } = await supabase
            .from('integrations')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('type', 'whatsapp_cloud_official')
            .maybeSingle();

        if (selErr) return apiError(500, selErr.message);

        let integrationId: string;
        if (existing) {
            integrationId = existing.id;
            const { error } = await supabase
                .from('integrations')
                .update({ config, status: 'active' })
                .eq('id', integrationId)
                .eq('organization_id', organizationId);
            if (error) return apiError(500, error.message);
        } else {
            const { data, error } = await supabase
                .from('integrations')
                .insert({
                    organization_id: organizationId,
                    name: 'WhatsApp Cloud (Oficial)',
                    type: 'whatsapp_cloud_official',
                    status: 'active',
                    config,
                })
                .select('id')
                .single();
            if (error) return apiError(500, error.message);
            integrationId = data.id;
        }

        // Service variant skips has_permission() because upstream auth already
        // enforced `manage_integrations` via assertManageIntegrations(auth).
        // See database/027_whatsapp_cloud_followup.sql.
        const { error: secErr } = await supabase.rpc('upsert_integration_secret_service', {
            p_integration_id: integrationId,
            p_org_id: organizationId,
            p_secret: { system_token },
        });
        if (secErr) return apiError(500, secErr.message);

        return Response.json({ integration_id: integrationId });
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.');
    }
}

export async function GET(req: NextRequest) {
    try {
        const auth = await authenticateRequest(req);
        // db is imported globally;

        const { data, error } = await supabase
            .from('integrations')
            .select('id, status, config')
            .eq('organization_id', auth.organizationId)
            .eq('type', 'whatsapp_cloud_official')
            .maybeSingle();

        if (error) return apiError(500, error.message);
        return Response.json(data ?? null);
    } catch (err: any) {
        return apiError(err.status || 500, err.message || 'Erro interno.');
    }
}
